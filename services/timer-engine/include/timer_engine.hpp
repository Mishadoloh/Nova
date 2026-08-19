#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace nova {

enum class PhaseKind { Focus, ShortBreak, LongBreak };

struct TimerConfig {
  int focus_minutes{25};
  int break_minutes{5};
  int long_break_minutes{15};
  int cycles{4};
  bool auto_start{false};
};

struct TimerPhase {
  PhaseKind kind;
  int cycle;
  std::int64_t duration_seconds;
  bool auto_start;
};

struct TimerPlan {
  std::string id;
  std::vector<TimerPhase> phases;
  std::int64_t total_seconds;
  int focus_sessions;
};

class TimerEngine {
 public:
  static TimerConfig validate(TimerConfig config);
  static TimerPlan build(const TimerConfig& config);
  static std::string to_json(const TimerPlan& plan);
  static std::string phase_name(PhaseKind kind);
};

TimerConfig parse_config(const std::string& json);

}  // namespace nova

