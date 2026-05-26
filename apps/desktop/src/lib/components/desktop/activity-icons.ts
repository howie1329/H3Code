import {
  AlertCircleIcon,
  AiBrain02Icon,
  Settings05Icon,
  StopCircleIcon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";

export function getActivityIcon(type: string) {
  const normalized = type.toLowerCase();

  if (normalized.includes("tool") || normalized.includes("execution")) {
    return TerminalIcon;
  }

  if (normalized.includes("agent") || normalized.includes("message")) {
    return AiBrain02Icon;
  }

  if (normalized.includes("error") || normalized.includes("fail")) {
    return AlertCircleIcon;
  }

  if (normalized.includes("abort") || normalized.includes("stop")) {
    return StopCircleIcon;
  }

  if (normalized.includes("session") || normalized.includes("state")) {
    return Settings05Icon;
  }

  return TerminalIcon;
}
