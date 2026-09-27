import { ArrowLeft, CalendarClock, Copy, Heart, RadioTower, Satellite, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CloudApiError,
  fetchPublicStation,
  hasCloudAuthentication,
  sendCloudStationSignal,
  setCloudStationFavorite,
  type PublicStationResponse,
  type StationSignalId,
} from "../game/cloud";
import type { PublicStationMetricKey } from "../game/types";
import { formatQuantityCompact } from "../game/quantityFormat";
import { ACHIEVEMENTS } from "../game/progression";
import { StationCanvasRenderer, type StationCanvasState } from "./StationCanvasRenderer";

const METRIC_LABELS: Record<PublicStationMetricKey, { label: string; unit: string }> = {
  "total-generation": { label: "累计发电", unit: "MJ" },
  "peak-throughput": { label: "实际吞吐峰值", unit: "/min" },
  "dyson-power": { label: "戴森功率", unit: "kW" },
  "explored-systems": { label: "探索星系", unit: "个" },
  "colonized-planets": { label: "殖民行星", unit: "颗" },
  "universe-matrix-produced": { label: "宇宙矩阵", unit: "份" },
  "solar-sails-launched": { label: "太阳帆发射", unit: "枚" },
  "carrier-rockets-launched": { label: "运载火箭发射", unit: "枚" },
};

const SIGNALS: Array<{ id: StationSignalId; label: string }> = [
  { id: "spectacular", label: "壮观" },
  { id: "precise", label: "精密" },
  { id: "industrial", label: "工业美学" },
  { id: "layout", label: "喜欢这个布局" },
];
const ACHIEVEMENT_NAMES = new Map<string, string>(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement.name]));

function formatMetric(value: number | string): string {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? formatQuantityCompact(Math.max(0, numeric)) : "--";
}

export function PublicStationPage({ publicId }: { publicId: string }) {
  const [data, setData] = useState<PublicStationResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState(false);
  const authenticated = hasCloudAuthentication();

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage(null);
    void fetchPublicStation(publicId).then((result) => {
      if (cancelled) return;
      setData(result);
      setStatus("ready");
      document.title = `${result.snapshot.profile.title} · ${__APP_DISPLAY_NAME__}空间站`;
    }).catch((error) => {
      if (cancelled) return;
      setStatus(error instanceof CloudApiError && error.status === 404 ? "missing" : "error");
      setMessage(error instanceof Error ? error.message : "空间站读取失败");
    });
    return () => { cancelled = true; };
  }, [publicId]);

  const station = useMemo<StationCanvasState | null>(() => data ? ({
    status: "operational",
    viewport: { x: 510, y: 270, zoom: 0.72 },
    economy: { stationReputation: data.snapshot.station.reputation },
    layout: {
      themeId: data.snapshot.station.themeId,
      placements: data.snapshot.station.placements,
    },
  }) : null, [data]);

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("空间站链接已复制");
    } catch {
      setMessage(url);
    }
  };

  const toggleFavorite = async () => {
    if (!data || socialBusy) return;
    setSocialBusy(true);
    setMessage(null);
    try {
      const social = await setCloudStationFavorite(publicId, !data.social.viewerFavorite);
      setData({ ...data, social });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "收藏操作失败");
    } finally {
      setSocialBusy(false);
    }
  };

  const signal = async (signalId: StationSignalId) => {
    if (!data || socialBusy) return;
    setSocialBusy(true);
    setMessage(null);
    try {
      const social = await sendCloudStationSignal(publicId, signalId);
      setData({ ...data, social });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "通讯信号发送失败");
    } finally {
      setSocialBusy(false);
    }
  };

  if (status !== "ready" || !data || !station) {
    return <main className="public-station-page public-station-page--state">
      <Satellite size={42} />
      <strong>{status === "loading" ? "正在接入空间站通讯信标" : status === "missing" ? "空间站不存在或已设为私密" : "空间站暂时无法访问"}</strong>
      <p>{message ?? (status === "loading" ? "只会读取脱敏公开快照，不会载入任何本地或云端工厂存档。" : "私密主页与不存在主页使用相同的不可访问状态。")}</p>
      <a href="/"><ArrowLeft size={16} />返回 {__APP_DISPLAY_NAME__}</a>
    </main>;
  }

  const { snapshot, social } = data;
  const featuredMetrics = Object.entries(snapshot.metrics) as Array<[PublicStationMetricKey, number | string]>;
  const aggregateMetrics = Object.entries(snapshot.aggregateMetrics) as Array<[PublicStationMetricKey, number | string]>;
  return <main className="public-station-page">
    <header className="public-station-header">
      <a href="/" aria-label={`返回 ${__APP_DISPLAY_NAME__}`}><ArrowLeft size={19} /></a>
      <div><i><Satellite size={23} /></i><span><small>公开空间站 · 只读访客模式</small><strong>{snapshot.profile.title}</strong></span></div>
      <button type="button" onClick={() => void copyLink()}><Copy size={16} />分享</button>
    </header>
    <section className="public-station-layout">
      <div className="public-station-canvas"><StationCanvasRenderer station={station} readOnly /></div>
      <aside className="public-station-profile">
        <section className="public-station-owner"><span>{snapshot.owner.avatar}</span><div><small>站主</small><strong>{snapshot.owner.displayName}</strong><p>{snapshot.profile.motto || "这位工程师尚未填写空间站简介。"}</p></div></section>
        <dl className="public-station-kpis">
          <div><dt><Trophy size={14} />等级</dt><dd>Lv.{snapshot.station.level}</dd></div>
          <div><dt><RadioTower size={14} />声望</dt><dd>{formatQuantityCompact(snapshot.station.reputation)}</dd></div>
          <div><dt><ShieldCheck size={14} />合同</dt><dd>{snapshot.station.completedContracts}</dd></div>
          <div><dt><CalendarClock size={14} />同步</dt><dd>{new Date(snapshot.publishedAt).toLocaleDateString("zh-CN")}</dd></div>
        </dl>
        {snapshot.station.featuredAchievementIds.length ? <section className="public-station-achievements"><header><strong>成就展柜</strong><small>站主选择公开</small></header><div>{snapshot.station.featuredAchievementIds.map((achievementId) => <span key={achievementId}><Trophy size={13} />{ACHIEVEMENT_NAMES.get(achievementId) ?? achievementId}</span>)}</div></section> : null}
        {snapshot.metricStatus === "content-pack-unverified" ? <p className="public-station-unverified">该空间站使用内容包：布局仅展示可验证的官方装饰，生产数据不作为官方成绩。</p> : null}
        <section className="public-station-metrics"><header><strong>安全聚合数据</strong><small>不含库存、线路或工厂布局</small></header>{aggregateMetrics.map(([key, value]) => <div key={key}><span>{METRIC_LABELS[key].label}</span><strong>{formatMetric(value)} <small>{METRIC_LABELS[key].unit}</small></strong></div>)}</section>
        {featuredMetrics.length ? <section className="public-station-metrics public-station-metrics--featured"><header><strong>站主精选数据</strong><small>主动选择的白名单项目</small></header>{featuredMetrics.map(([key, value]) => <div key={key}><span>{METRIC_LABELS[key].label}</span><strong>{formatMetric(value)} <small>{METRIC_LABELS[key].unit}</small></strong></div>)}</section> : null}
        {snapshot.station.featuredContract ? <section className="public-station-featured-contract"><Trophy size={18} /><div><small>精选出口合同 · {snapshot.station.featuredContract.difficulty}</small><strong>{snapshot.station.featuredContract.title}</strong></div></section> : null}
        <section className="public-station-social"><header><strong>轻通讯</strong><small>不发放奖励，也不参与排名</small></header><button type="button" disabled={!authenticated || socialBusy} className={social.viewerFavorite ? "active" : ""} onClick={() => void toggleFavorite()}><Heart size={15} fill={social.viewerFavorite ? "currentColor" : "none"} />{social.viewerFavorite ? "已收藏" : "收藏"} · {social.favoriteCount}</button><div>{SIGNALS.map((entry) => <button type="button" disabled={!authenticated || socialBusy} className={social.viewerSignal === entry.id ? "active" : ""} onClick={() => void signal(entry.id)} key={entry.id}>{entry.label}<small>{social.signals[entry.id]}</small></button>)}</div>{!authenticated ? <p><UserRound size={14} />登录云账号后可以收藏并发送预设通讯信号。</p> : null}</section>
        {message ? <p className="public-station-message" role="status">{message}</p> : null}
      </aside>
    </section>
  </main>;
}
