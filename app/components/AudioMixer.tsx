"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Track = { id: string; name: string; icon: string; src: string; detail: string };
type Levels = Record<string, number>;

const tracks: Track[] = [
  { id: "rain", name: "Дощ", icon: "◌", src: "/audio/rain.ogg", detail: "Мʼякий рівний шум" },
  { id: "cafe", name: "Кавʼярня", icon: "≋", src: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Restaurant_ambience.ogg", detail: "Легкий людський фон" },
  { id: "forest", name: "Ліс", icon: "⌁", src: "/audio/forest.ogg", detail: "Птахи та листя" },
  { id: "stream", name: "Струмок", icon: "≈", src: "/audio/stream.ogg", detail: "Проточна вода" },
  { id: "wind", name: "Вітер", icon: "∿", src: "/audio/wind.ogg", detail: "Глибокий простір" },
];

const initialLevels: Levels = { rain: 42, cafe: 24, forest: 30, stream: 32, wind: 22 };
const presets = [
  { id: "deep", name: "Deep work", icon: "◎", levels: { rain: 46, cafe: 12, forest: 0, stream: 18, wind: 0 } },
  { id: "nature", name: "Природа", icon: "◇", levels: { rain: 0, cafe: 0, forest: 44, stream: 38, wind: 12 } },
  { id: "storm", name: "Шторм", icon: "↯", levels: { rain: 62, cafe: 0, forest: 0, stream: 12, wind: 38 } },
  { id: "coffee", name: "Кавова пауза", icon: "◉", levels: { rain: 12, cafe: 52, forest: 0, stream: 0, wind: 0 } },
];

export function AudioMixer() {
  const audio = useRef<Record<string, HTMLAudioElement>>({});
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Levels>(initialLevels);
  const [master, setMaster] = useState(70);
  const [preset, setPreset] = useState<string | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  const stopAll = useCallback(() => {
    Object.values(audio.current).forEach((item) => item.pause());
    setActive({});
    setPreset(null);
    setSleepEndsAt(null);
    setRemaining(0);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("nova-audio-mixer-v2") || "null");
      if (saved?.levels) setLevels({ ...initialLevels, ...saved.levels });
      if (typeof saved?.master === "number") setMaster(saved.master);
    } catch { /* use defaults */ }
    return () => Object.values(audio.current).forEach((item) => { item.pause(); item.src = ""; });
  }, []);

  useEffect(() => {
    localStorage.setItem("nova-audio-mixer-v2", JSON.stringify({ levels, master }));
    tracks.forEach((track) => {
      const element = audio.current[track.id];
      if (element) element.volume = (levels[track.id] ?? 0) / 100 * master / 100;
    });
  }, [levels, master]);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) stopAll();
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [sleepEndsAt, stopAll]);

  const getAudio = (track: Track) => {
    if (!audio.current[track.id]) {
      const element = new Audio(track.src);
      element.loop = true;
      element.preload = "auto";
      element.volume = (levels[track.id] ?? 0) / 100 * master / 100;
      audio.current[track.id] = element;
    }
    return audio.current[track.id];
  };

  const toggle = (track: Track) => {
    const element = getAudio(track);
    setPreset(null);
    if (active[track.id]) {
      element.pause();
      setActive((value) => ({ ...value, [track.id]: false }));
      return;
    }
    element.play().then(() => {
      setFailed(null);
      setActive((value) => ({ ...value, [track.id]: true }));
    }).catch(() => setFailed(track.id));
  };

  const applyPreset = (selected: typeof presets[number]) => {
    Object.values(audio.current).forEach((item) => item.pause());
    setLevels((value) => ({ ...value, ...selected.levels }));
    setPreset(selected.id);
    setFailed(null);
    const next: Record<string, boolean> = {};
    tracks.forEach((track) => {
      if ((selected.levels[track.id as keyof typeof selected.levels] ?? 0) > 0) {
        const element = getAudio(track);
        element.volume = (selected.levels[track.id as keyof typeof selected.levels] ?? 0) / 100 * master / 100;
        element.play().then(() => setActive((value) => ({ ...value, [track.id]: true }))).catch(() => setFailed(track.id));
        next[track.id] = true;
      }
    });
    setActive(next);
  };

  const activeCount = Object.values(active).filter(Boolean).length;
  const timerLabel = remaining ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}` : "Таймер";

  return <section className="sound-card mixer-card">
    <div className="sound-heading">
      <div><span className="eyebrow">Focus studio · {activeCount} активні</span><h2>Твоя атмосфера</h2></div>
      <button type="button" className="sound-stop" onClick={stopAll} aria-label="Зупинити всі звуки">■</button>
    </div>
    <div className="mixer-presets" aria-label="Готові звукові сцени">
      {presets.map((item) => <button key={item.id} className={preset === item.id ? "active" : ""} type="button" onClick={() => applyPreset(item)}><i>{item.icon}</i><span>{item.name}</span></button>)}
    </div>
    <div className="mixer-tracks">
      {tracks.map((track) => <div className={active[track.id] ? "playing" : ""} key={track.id}>
        <button type="button" onClick={() => toggle(track)} aria-pressed={Boolean(active[track.id])} title={track.detail}><i>{track.icon}</i><span>{track.name}<small>{track.detail}</small></span><b>{active[track.id] ? "Ⅱ" : "▶"}</b></button>
        <input type="range" min="0" max="100" value={levels[track.id]} onChange={(event) => { setPreset(null); setLevels((value) => ({ ...value, [track.id]: Number(event.target.value) })); }} aria-label={`Гучність: ${track.name}`} />
        <output>{levels[track.id]}%</output>
      </div>)}
    </div>
    {failed && <p className="mixer-error">Не вдалося запустити один зі звуків. Спробуй ще раз.</p>}
    <div className="mixer-footer">
      <label className="volume master-volume"><span>Загальна гучність</span><input type="range" min="0" max="100" value={master} onChange={(event) => setMaster(Number(event.target.value))}/><b>{master}%</b></label>
      <div className="sleep-timer"><span>{timerLabel}</span>{[15, 30, 60].map((minutes) => <button type="button" key={minutes} className={sleepEndsAt && Math.abs(sleepEndsAt - Date.now() - minutes * 60000) < 5000 ? "active" : ""} onClick={() => setSleepEndsAt(Date.now() + minutes * 60000)}>{minutes} хв</button>)}</div>
    </div>
  </section>;
}
