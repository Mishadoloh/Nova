import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name:"NOVA — фокус-кокпіт", short_name:"NOVA", description:"Проєкти, Pomodoro, календар і статистика фокусу.", start_url:"/", display:"standalone", background_color:"#0b0d0c", theme_color:"#dfff00", lang:"uk", icons:[{src:"/favicon.svg",sizes:"any",type:"image/svg+xml"}] }; }
