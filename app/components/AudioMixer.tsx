"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Track = { id: string; name: string; icon: string; src?: string; detail: string; procedural?: boolean };
type Levels = Record<string, number>;
type ZoneEngine = { context: AudioContext; output: GainNode; clickTimer: number };

const tracks: Track[] = [
  { id: "rain", name: "Дощ", icon: "◌", src: "/audio/rain.ogg", detail: "Мʼякий рівний шум" },
  { id: "cafe", name: "Кавʼярня", icon: "≋", src: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Restaurant_ambience.ogg", detail: "Легкий людський фон" },
  { id: "forest", name: "Ліс", icon: "⌁", src: "/audio/forest.ogg", detail: "Птахи та листя" },
  { id: "stream", name: "Струмок", icon: "≈", src: "/audio/stream.ogg", detail: "Проточна вода" },
  { id: "wind", name: "Вітер", icon: "∿", src: "/audio/wind.ogg", detail: "Глибокий простір" },
  { id: "zone", name: "Покинута зона", icon: "⌾", detail: "Дрон, радіошум і дозиметр", procedural: true },
];

const initialLevels: Levels = { rain: 42, cafe: 24, forest: 30, stream: 32, wind: 22, zone: 34 };
const presets = [
  { id: "deep", name: "Deep work", icon: "◎", levels: { rain: 46, cafe: 12, forest: 0, stream: 18, wind: 0, zone: 0 } },
  { id: "nature", name: "Природа", icon: "◇", levels: { rain: 0, cafe: 0, forest: 44, stream: 38, wind: 12, zone: 0 } },
  { id: "storm", name: "Шторм", icon: "↯", levels: { rain: 62, cafe: 0, forest: 0, stream: 12, wind: 38, zone: 0 } },
  { id: "coffee", name: "Кавова пауза", icon: "◉", levels: { rain: 12, cafe: 52, forest: 0, stream: 0, wind: 0, zone: 0 } },
  { id: "zone", name: "Зона", icon: "⌾", levels: { rain: 10, cafe: 0, forest: 0, stream: 0, wind: 24, zone: 48 } },
];

export function AudioMixer() {
  const audio = useRef<Record<string, HTMLAudioElement>>({});
  const zone = useRef<ZoneEngine | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [levels, setLevels] = useState<Levels>(initialLevels);
  const [master, setMaster] = useState(70);
  const [preset, setPreset] = useState<string | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  const stopAll = useCallback(() => {
    Object.values(audio.current).forEach((item) => item.pause());
    if (zone.current) {
      window.clearInterval(zone.current.clickTimer);
      zone.current.context.close().catch(() => undefined);
      zone.current = null;
    }
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
    return () => {
      Object.values(audio.current).forEach((item) => { item.pause(); item.src = ""; });
      if (zone.current) {
        window.clearInterval(zone.current.clickTimer);
        zone.current.context.close().catch(() => undefined);
        zone.current = null;
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("nova-audio-mixer-v2", JSON.stringify({ levels, master }));
    tracks.forEach((track) => {
      const element = audio.current[track.id];
      if (element) element.volume = (levels[track.id] ?? 0) / 100 * master / 100;
    });
    if (zone.current) zone.current.output.gain.setTargetAtTime((levels.zone ?? 0) / 100 * master / 100 * 0.72, zone.current.context.currentTime, 0.08);
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
      const element = new Audio(track.src!);
      element.loop = true;
      element.preload = "auto";
      element.volume = (levels[track.id] ?? 0) / 100 * master / 100;
      audio.current[track.id] = element;
    }
    return audio.current[track.id];
  };

  const startZone = () => {
    if (zone.current) return;
    const context = new AudioContext();
    const output = context.createGain();
    output.gain.value = (levels.zone ?? 0) / 100 * master / 100 * 0.72;
    output.connect(context.destination);

    const drone = context.createOscillator();
    const droneGain = context.createGain();
    drone.type = "sine";
    drone.frequency.value = 48;
    droneGain.gain.value = 0.11;
    drone.connect(droneGain).connect(output);
    drone.start();

    const harmonic = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonic.type = "triangle";
    harmonic.frequency.value = 73;
    harmonic.detune.value = -9;
    harmonicGain.gain.value = 0.035;
    harmonic.connect(harmonicGain).connect(output);
    harmonic.start();

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < noiseData.length; index += 1) {
      brown = (brown + 0.018 * (Math.random() * 2 - 1)) / 1.018;
      noiseData[index] = brown * 3.2;
    }
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 380;
    noiseFilter.Q.value = 0.42;
    noiseGain.gain.value = 0.24;
    noise.connect(noiseFilter).connect(noiseGain).connect(output);
    noise.start();

    const clickTimer = window.setInterval(() => {
      if (!zone.current || Math.random() > 0.58) return;
      const click = context.createOscillator();
      const clickGain = context.createGain();
      const now = context.currentTime;
      click.type = "square";
      click.frequency.value = 950 + Math.random() * 1900;
      clickGain.gain.setValueAtTime(0.0001, now);
      clickGain.gain.exponentialRampToValueAtTime(0.07 + Math.random() * 0.06, now + 0.004);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035 + Math.random() * 0.025);
      click.connect(clickGain).connect(output);
      click.start(now);
      click.stop(now + 0.08);
    }, 430);
    zone.current = { context, output, clickTimer };
  };

  const stopZone = () => {
    if (!zone.current) return;
    window.clearInterval(zone.current.clickTimer);
    zone.current.context.close().catch(() => undefined);
    zone.current = null;
  };

  const toggle = (track: Track) => {
    if (track.procedural) {
      setPreset(null);
      if (active[track.id]) stopZone(); else startZone();
      setActive((value) => ({ ...value, [track.id]: !value[track.id] }));
      return;
    }
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
    stopZone();
    setLevels((value) => ({ ...value, ...selected.levels }));
    setPreset(selected.id);
    setFailed(null);
    const next: Record<string, boolean> = {};
    tracks.forEach((track) => {
      if ((selected.levels[track.id as keyof typeof selected.levels] ?? 0) > 0) {
        if (track.procedural) {
          startZone();
          next[track.id] = true;
          return;
        }
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
