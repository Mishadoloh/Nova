#include "timer_engine.hpp"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <csignal>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>

namespace {

volatile std::sig_atomic_t running = 1;

struct Request {
  std::string method;
  std::string path;
  std::map<std::string, std::string> headers;
  std::string body;
};

std::string trim(std::string value) {
  const auto first = value.find_first_not_of(" \t\r\n");
  if (first == std::string::npos) return "";
  const auto last = value.find_last_not_of(" \t\r\n");
  return value.substr(first, last - first + 1);
}

std::string lower(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(),
                 [](unsigned char character) { return std::tolower(character); });
  return value;
}

std::string response(int status, std::string_view status_text,
                     std::string_view body) {
  std::ostringstream output;
  output << "HTTP/1.1 " << status << ' ' << status_text << "\r\n"
         << "Content-Type: application/json; charset=utf-8\r\n"
         << "Content-Length: " << body.size() << "\r\n"
         << "Cache-Control: no-store\r\n"
         << "X-Content-Type-Options: nosniff\r\n"
         << "Connection: close\r\n\r\n"
         << body;
  return output.str();
}

void send_all(int client, const std::string& message) {
  std::size_t sent = 0;
  while (sent < message.size()) {
    const auto count = ::send(client, message.data() + sent, message.size() - sent,
                              MSG_NOSIGNAL);
    if (count <= 0) return;
    sent += static_cast<std::size_t>(count);
  }
}

Request read_request(int client) {
  constexpr std::size_t max_request = 128 * 1024;
  std::string data;
  data.reserve(4096);
  char buffer[4096];
  std::size_t expected_size = 0;

  while (data.size() < max_request) {
    const auto count = ::recv(client, buffer, sizeof(buffer), 0);
    if (count <= 0) break;
    data.append(buffer, static_cast<std::size_t>(count));
    const auto header_end = data.find("\r\n\r\n");
    if (header_end != std::string::npos) {
      if (expected_size == 0) {
        const auto length_position = lower(data.substr(0, header_end)).find("content-length:");
        if (length_position != std::string::npos) {
          const auto value_start = length_position + std::strlen("content-length:");
          const auto value_end = data.find("\r\n", value_start);
          expected_size = static_cast<std::size_t>(
              std::stoul(trim(data.substr(value_start, value_end - value_start))));
        }
      }
      if (data.size() >= header_end + 4 + expected_size) break;
    }
  }
  if (data.size() >= max_request) throw std::runtime_error("request too large");

  const auto header_end = data.find("\r\n\r\n");
  if (header_end == std::string::npos) throw std::runtime_error("invalid HTTP request");
  std::istringstream header_stream(data.substr(0, header_end));
  Request request;
  std::string version;
  header_stream >> request.method >> request.path >> version;
  std::string line;
  std::getline(header_stream, line);
  while (std::getline(header_stream, line)) {
    const auto separator = line.find(':');
    if (separator == std::string::npos) continue;
    request.headers[lower(trim(line.substr(0, separator)))] = trim(line.substr(separator + 1));
  }
  request.body = data.substr(header_end + 4, expected_size);
  return request;
}

bool authorized(const Request& request) {
  const char* token = std::getenv("NOVA_INTERNAL_TOKEN");
  if (token == nullptr || std::strlen(token) < 12) return false;
  const auto iterator = request.headers.find("authorization");
  return iterator != request.headers.end() && iterator->second == std::string("Bearer ") + token;
}

std::string route(const Request& request) {
  if (request.method == "GET" && request.path == "/health") {
    return response(200, "OK",
                    "{\"ok\":true,\"service\":\"nova-timer-engine\",\"version\":\"1.0.0\"}");
  }
  if (request.method != "POST" || request.path != "/v1/timer/plan") {
    return response(404, "Not Found",
                    "{\"ok\":false,\"error\":{\"code\":\"NOT_FOUND\",\"message\":\"route not found\"}}");
  }
  if (!authorized(request)) {
    return response(401, "Unauthorized",
                    "{\"ok\":false,\"error\":{\"code\":\"AUTH_REQUIRED\",\"message\":\"service authentication failed\"}}");
  }
  const auto plan = nova::TimerEngine::build(nova::parse_config(request.body));
  return response(200, "OK", nova::TimerEngine::to_json(plan));
}

void stop_server(int) { running = 0; }

int port() {
  const char* value = std::getenv("NOVA_TIMER_PORT");
  if (value == nullptr) return 8070;
  return std::clamp(std::atoi(value), 1024, 65535);
}

int healthcheck() {
  const int socket_fd = ::socket(AF_INET, SOCK_STREAM, 0);
  if (socket_fd < 0) return 1;
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(static_cast<std::uint16_t>(port()));
  inet_pton(AF_INET, "127.0.0.1", &address.sin_addr);
  const bool connected = ::connect(socket_fd, reinterpret_cast<sockaddr*>(&address),
                                   sizeof(address)) == 0;
  if (connected) {
    const std::string request =
        "GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n";
    send_all(socket_fd, request);
  }
  ::close(socket_fd);
  return connected ? 0 : 1;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc > 1 && std::string(argv[1]) == "healthcheck") return healthcheck();
  std::signal(SIGINT, stop_server);
  std::signal(SIGTERM, stop_server);

  const int server = ::socket(AF_INET, SOCK_STREAM, 0);
  if (server < 0) {
    std::cerr << "unable to create socket: " << std::strerror(errno) << '\n';
    return 1;
  }
  int reuse = 1;
  setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));
  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = INADDR_ANY;
  address.sin_port = htons(static_cast<std::uint16_t>(port()));
  if (::bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0 ||
      ::listen(server, 64) < 0) {
    std::cerr << "unable to bind timer engine: " << std::strerror(errno) << '\n';
    ::close(server);
    return 1;
  }
  std::cout << "nova timer engine listening on port " << port() << std::endl;
  while (running) {
    const int client = ::accept(server, nullptr, nullptr);
    if (client < 0) {
      if (errno == EINTR) continue;
      break;
    }
    try {
      send_all(client, route(read_request(client)));
    } catch (const std::exception& error) {
      send_all(client, response(400, "Bad Request",
                                "{\"ok\":false,\"error\":{\"code\":\"BAD_REQUEST\",\"message\":\"invalid request\"}}"));
      std::cerr << "request failed: " << error.what() << '\n';
    }
    ::close(client);
  }
  ::close(server);
  return 0;
}

