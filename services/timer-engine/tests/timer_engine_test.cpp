#include "timer_engine.hpp"

#include <cassert>
#include <iostream>
#include <string>

int main() {
  const auto config = nova::parse_config(
      R"({"focusMinutes":50,"breakMinutes":10,"longBreakMinutes":25,"cycles":4,"autoStart":true})");
  assert(config.focus_minutes == 50);
  assert(config.break_minutes == 10);
  assert(config.long_break_minutes == 25);
  assert(config.cycles == 4);
  assert(config.auto_start);

  const auto plan = nova::TimerEngine::build(config);
  assert(plan.focus_sessions == 4);
  assert(plan.phases.size() == 8);
  assert(plan.phases.front().kind == nova::PhaseKind::Focus);
  assert(plan.phases.front().duration_seconds == 3000);
  assert(plan.phases.back().kind == nova::PhaseKind::LongBreak);
  assert(plan.phases.back().duration_seconds == 1500);
  assert(plan.total_seconds == 4 * 3000 + 3 * 600 + 1500);
  assert(nova::TimerEngine::to_json(plan).find("\"focusSessions\":4") !=
         std::string::npos);

  const auto bounded = nova::TimerEngine::validate({-20, 500, 0, 100, false});
  assert(bounded.focus_minutes == 1);
  assert(bounded.break_minutes == 60);
  assert(bounded.long_break_minutes == 5);
  assert(bounded.cycles == 12);
  std::cout << "timer engine tests passed\n";
  return 0;
}

