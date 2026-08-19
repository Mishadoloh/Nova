#include "timer_engine.hpp"

#include <algorithm>
#include <chrono>
#include <functional>
#include <regex>
#include <sstream>
#include <stdexcept>

namespace nova {
namespace {

int integer_field(const std::string& json, const std::string& name,
                  int fallback) {
  const std::regex pattern("\\\"" + name + "\\\"\\s*:\\s*(-?[0-9]+)");
  std::smatch match;
  if (!std::regex_search(json, match, pattern)) return fallback;
  try {
    return std::stoi(match[1].str());
  } catch (const std::exception&) {
    return fallback;
  }
}

bool boolean_field(const std::string& json, const std::string& name,
                   bool fallback) {
  const std::regex pattern("\\\"" + name + "\\\"\\s*:\\s*(true|false)");
  std::smatch match;
  if (!std::regex_search(json, match, pattern)) return fallback;
  return match[1].str() == "true";
}

}  // namespace

TimerConfig TimerEngine::validate(TimerConfig config) {
  config.focus_minutes = std::clamp(config.focus_minutes, 1, 120);
  config.break_minutes = std::clamp(config.break_minutes, 1, 60);
  config.long_break_minutes = std::clamp(config.long_break_minutes, 5, 90);
  config.cycles = std::clamp(config.cycles, 1, 12);
  return config;
}

TimerPlan TimerEngine::build(const TimerConfig& raw_config) {
  const auto config = validate(raw_config);
  TimerPlan plan;
  plan.total_seconds = 0;
  plan.focus_sessions = config.cycles;
  plan.phases.reserve(static_cast<std::size_t>(config.cycles * 2));

  for (int cycle = 1; cycle <= config.cycles; ++cycle) {
    plan.phases.push_back({PhaseKind::Focus, cycle,
                           static_cast<std::int64_t>(config.focus_minutes) * 60,
                           cycle == 1 ? false : config.auto_start});
    const bool final_cycle = cycle == config.cycles;
    const auto break_kind = final_cycle ? PhaseKind::LongBreak : PhaseKind::ShortBreak;
    const int break_minutes =
        final_cycle ? config.long_break_minutes : config.break_minutes;
    plan.phases.push_back({break_kind, cycle,
                           static_cast<std::int64_t>(break_minutes) * 60,
                           config.auto_start});
  }

  for (const auto& phase : plan.phases) plan.total_seconds += phase.duration_seconds;
  const auto seed = std::to_string(config.focus_minutes) + ":" +
                    std::to_string(config.break_minutes) + ":" +
                    std::to_string(config.long_break_minutes) + ":" +
                    std::to_string(config.cycles) + ":" +
                    (config.auto_start ? "1" : "0");
  std::ostringstream id;
  id << "plan-" << std::hex << std::hash<std::string>{}(seed);
  plan.id = id.str();
  return plan;
}

std::string TimerEngine::phase_name(PhaseKind kind) {
  switch (kind) {
    case PhaseKind::Focus:
      return "focus";
    case PhaseKind::ShortBreak:
      return "short_break";
    case PhaseKind::LongBreak:
      return "long_break";
  }
  throw std::logic_error("unknown phase kind");
}

std::string TimerEngine::to_json(const TimerPlan& plan) {
  std::ostringstream output;
  output << "{\"ok\":true,\"data\":{\"planId\":\"" << plan.id
         << "\",\"totalSeconds\":" << plan.total_seconds
         << ",\"focusSessions\":" << plan.focus_sessions << ",\"phases\":[";
  for (std::size_t index = 0; index < plan.phases.size(); ++index) {
    if (index > 0) output << ',';
    const auto& phase = plan.phases[index];
    output << "{\"kind\":\"" << phase_name(phase.kind) << "\",\"cycle\":"
           << phase.cycle << ",\"durationSeconds\":" << phase.duration_seconds
           << ",\"autoStart\":" << (phase.auto_start ? "true" : "false") << '}';
  }
  output << "]}}";
  return output.str();
}

TimerConfig parse_config(const std::string& json) {
  TimerConfig config;
  config.focus_minutes = integer_field(json, "focusMinutes", config.focus_minutes);
  config.break_minutes = integer_field(json, "breakMinutes", config.break_minutes);
  config.long_break_minutes =
      integer_field(json, "longBreakMinutes", config.long_break_minutes);
  config.cycles = integer_field(json, "cycles", config.cycles);
  config.auto_start = boolean_field(json, "autoStart", config.auto_start);
  return TimerEngine::validate(config);
}

}  // namespace nova

