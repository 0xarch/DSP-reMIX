import { Bell, ChevronDown, ChevronLeft, Orbit, Pause, Play, Zap } from "lucide-react";
import { getPlanet } from "../../game/content";
import { getPlanetDisplayName } from "../../game/galaxy";
import type { GameState } from "../../game/types";
import type { MobileRoute } from "../../hooks/useMobileNavigation";

const WORKSPACE_TITLES = {
  technology: "科技树",
  statistics: "生产统计",
  recipes: "生产资料库",
  "star-map": "星图与星际工业",
  blueprints: "蓝图库",
  dyson: "戴森规划",
  campaign: "主线任务",
  operations: "运营中心",
  galaxy: "银河网络",
  "construction-center": "建筑制造中心",
  "orbital-station": "全星系空间站",
} as const;

export function MobileTopBar({ game, route, alertCount, onBack, onOpenPlanet, onTogglePause, onOpenAlerts }: {
  game: GameState;
  route: MobileRoute;
  alertCount: number;
  onBack: () => void;
  onOpenPlanet: () => void;
  onTogglePause: () => void;
  onOpenAlerts: () => void;
}) {
  if (route.kind !== "factory") {
    const title = route.kind === "hub" ? "更多工作区" : WORKSPACE_TITLES[route.id];
    const backLabel = route.kind === "workspace" && route.subview ? `返回${title}列表` : `返回工厂，关闭${title}`;
    return (
      <header className="mobile-next-topbar mobile-next-topbar--workspace">
        <button type="button" onClick={onBack} aria-label={backLabel}><ChevronLeft size={22} /><span>返回</span></button>
        <div><small>{__APP_DISPLAY_NAME__}</small><strong>{title}</strong></div>
        <span className="mobile-next-topbar__spacer" aria-hidden="true" />
      </header>
    );
  }

  const planet = getPlanet(game.activePlanetId);
  const powerPercent = Math.round(game.metrics.powerFactor * 100);
  const powerTone = powerPercent >= 100 ? "positive" : powerPercent > 0 ? "warning" : "negative";
  return (
    <header className="mobile-next-topbar">
      <button className="mobile-next-planet-command" type="button" onClick={onOpenPlanet} aria-label={`切换行星，当前${getPlanetDisplayName(game, game.activePlanetId)}`}>
        <Orbit size={20} />
        <span><strong>{getPlanetDisplayName(game, game.activePlanetId)}</strong><small>{planet.code}</small></span>
        <ChevronDown size={16} />
      </button>
      <div className={`mobile-next-power mobile-next-power--${powerTone}`} aria-label={`供电效率 ${powerPercent}%`}>
        <Zap size={18} /><span>供电</span><strong>{powerPercent}%</strong>
      </div>
      <button type="button" onClick={onTogglePause} aria-label={game.paused ? "继续模拟" : "暂停模拟"} aria-keyshortcuts="Space">
        {game.paused ? <Play size={21} /> : <Pause size={21} />}
      </button>
      <button className={alertCount > 0 ? "has-alerts" : ""} type="button" onClick={onOpenAlerts} aria-label={`打开警报，当前 ${alertCount} 条`}>
        <Bell size={21} />{alertCount > 0 ? <b>{Math.min(99, alertCount)}</b> : null}
      </button>
    </header>
  );
}
