"use client";

import { useEffect, useState } from "react";
import { AppFrame, PageTitle } from "../components/AppFrame";
import { useNovaStore } from "../components/nova-store";

export default function SettingsPage() {
  const { data, save, syncing } = useNovaStore();
  const [focus, setFocus] = useState<number | null>(null); const [pause, setPause] = useState<number | null>(null); const [auto, setAuto] = useState<boolean | null>(null);
  const [installPrompt,setInstallPrompt]=useState<(Event&{prompt:()=>Promise<void>})|null>(null);
  useEffect(()=>{const capture=(event:Event)=>{event.preventDefault();setInstallPrompt(event as Event&{prompt:()=>Promise<void>})};window.addEventListener("beforeinstallprompt",capture);return()=>window.removeEventListener("beforeinstallprompt",capture)},[]);
  const preferences = { focusMinutes: focus ?? data.preferences.focusMinutes, breakMinutes: pause ?? data.preferences.breakMinutes, autoPomodoro: auto ?? data.preferences.autoPomodoro };
  return <AppFrame active="settings">
    <PageTitle eyebrow="Персоналізація" title="Налаштування" description="Збери систему, яка підлаштовується під тебе — не навпаки." />
    <section className="settings-page-grid"><div className="settings-group"><span className="eyebrow">Таймер</span><h2>Pomodoro-цикл</h2><div className="settings-field"><label>Тривалість фокусу<small>Від 1 до 120 хвилин</small></label><div><button type="button" onClick={()=>setFocus(Math.max(1,preferences.focusMinutes-5))}>−</button><strong>{preferences.focusMinutes} хв</strong><button type="button" onClick={()=>setFocus(Math.min(120,preferences.focusMinutes+5))}>+</button></div></div><div className="settings-field"><label>Тривалість перерви<small>Від 1 до 60 хвилин</small></label><div><button type="button" onClick={()=>setPause(Math.max(1,preferences.breakMinutes-1))}>−</button><strong>{preferences.breakMinutes} хв</strong><button type="button" onClick={()=>setPause(Math.min(60,preferences.breakMinutes+1))}>+</button></div></div><label className="settings-switch"><span>Автоматично запускати наступний цикл<small>Фокус і перерва змінюються самі</small></span><input type="checkbox" checked={preferences.autoPomodoro} onChange={(event)=>setAuto(event.target.checked)} /><i /></label></div><div className="settings-group"><span className="eyebrow">Сповіщення</span><h2>Залишайся в ритмі</h2><label className="settings-switch"><span>Завершення сесії<small>Сигнал, коли таймер доходить до нуля</small></span><input type="checkbox" defaultChecked /><i /></label><label className="settings-switch"><span>Щоденне нагадування<small>М’яке нагадування о 09:00</small></span><input type="checkbox" /><i /></label><label className="settings-switch"><span>Нові досягнення<small>Повідомляти про відкриті нагороди</small></span><input type="checkbox" defaultChecked /><i /></label></div><div className="settings-group install-group"><span className="eyebrow">Мобільність</span><h2>NOVA як застосунок</h2><p>Встанови NOVA на головний екран. Основні сторінки відкриватимуться навіть без мережі, а зміни дочекаються синхронізації.</p><ul><li>Офлайн-доступ</li><li>Повноекранний режим</li><li>Швидкий запуск</li></ul><button type="button" disabled={!installPrompt} onClick={()=>installPrompt?.prompt()}>{installPrompt?"Встановити NOVA ↓":"Уже встановлено або відкрий меню браузера"}</button></div></section>
    <div className="settings-save"><span>{syncing ? "Зберігаю зміни…" : "Налаштування синхронізуються між пристроями"}</span><button type="button" onClick={()=>save({...data,preferences})}>Зберегти зміни</button></div>
  </AppFrame>;
}
