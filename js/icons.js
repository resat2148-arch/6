// The game's drawn icon set: one line weight, rounded joins and a soft tinted fill, so the interface
// looks the same on every system (emoji fonts differ between Windows, macOS, Android and iOS).
// Icons take the text colour; .ic-* classes in style.css give the few coloured ones their tint.

const S = {
  home: '<path class="f" d="M5 10.5V20h14v-9.5L12 5z"/><path d="M3 11.5 12 4l9 7.5M5 10v10h14V10M10 20v-5h4v5"/>',
  war: '<path class="f" d="M3 3l2.8.4 9.2 9.2-2.4 2.4-9.2-9.2zM21 3l-2.8.4L9 12.6l2.4 2.4 9.2-9.2z"/><path d="M3 3l2.8.4 9.2 9.2-2.4 2.4-9.2-9.2zM21 3l-2.8.4L9 12.6l2.4 2.4 9.2-9.2zM11.6 16.8l5.2-5.2M7.2 11.6l5.2 5.2M15.4 15.4l3.4 3.4M8.6 15.4l-3.4 3.4"/><circle cx="19.6" cy="19.6" r="1.1"/><circle cx="4.4" cy="19.6" r="1.1"/>',
  economy: '<path class="f" d="M3 20V10.5l5 3v-3l5 3v-3l5 3V4h3v16z"/><path d="M3 20V10.5l5 3v-3l5 3v-3l5 3V4h3v16zM7 17h2M12 17h2M17 17h1"/>',
  market: '<path class="f" d="M7 7h13l-1.8 7H8.6z"/><path d="M2.5 4H5l2.6 11.5h10.6L20.5 7H6.2"/><circle cx="9.5" cy="19.2" r="1.4"/><circle cx="17" cy="19.2" r="1.4"/>',
  politics: '<path class="f" d="M3.5 9 12 4l8.5 5z"/><path d="M3.5 9 12 4l8.5 5zM5.5 11v6.5M9.8 11v6.5M14.2 11v6.5M18.5 11v6.5M3.5 20.5h17M4.5 18h15"/>',
  people: '<circle class="f" cx="9" cy="8" r="3.2"/><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="16.8" cy="9.2" r="2.5"/><path d="M15.6 14.3c3 .2 5.2 2.4 5.2 5.7"/>',
  medals: '<path d="M8 3l3.2 6.2M16 3l-3.2 6.2"/><circle class="f" cx="12" cy="15" r="5.5"/><circle cx="12" cy="15" r="5.5"/><path d="M12 12.3l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z"/>',
  bolt: '<path class="f" d="M13.5 2.5 4.5 14h6.5l-1 7.5 9.5-12H13z"/><path d="M13.5 2.5 4.5 14h6.5l-1 7.5 9.5-12H13z"/>',
  money: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.4c-.6-.8-1.6-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2s1.2 1.6 2.8 1.9 2.9.8 2.9 2-1.2 2-2.9 2c-1.3 0-2.4-.5-3-1.3M12 6.6v1.6M12 15.8v1.6"/>',
  gold: '<path class="f" d="M3 18.5 6 13h12l3 5.5zM7.5 12.5l2.5-5h4l2.5 5z"/><path d="M3 18.5 6 13h12l3 5.5zM7.5 12.5l2.5-5h4l2.5 5z"/>',
  music: '<path d="M9 17.5V6l10-2.2v11.5"/><circle class="f" cx="6.8" cy="17.6" r="2.3"/><circle class="f" cx="16.8" cy="15.4" r="2.3"/><circle cx="6.8" cy="17.6" r="2.3"/><circle cx="16.8" cy="15.4" r="2.3"/>',
  sound: '<path class="f" d="M3.5 9.5h4l5-4v13l-5-4h-4z"/><path d="M3.5 9.5h4l5-4v13l-5-4h-4zM16 9.2a4 4 0 0 1 0 5.6M18.6 6.6a7.6 7.6 0 0 1 0 10.8"/>',
  mute: '<path class="f" d="M3.5 9.5h4l5-4v13l-5-4h-4z"/><path d="M3.5 9.5h4l5-4v13l-5-4h-4zM16 9.5l5 5M21 9.5l-5 5"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  work: '<path class="f" d="M13.2 3.6l6.8 6.8-2.9 2.9-6.8-6.8z"/><path d="M13.2 3.6l6.8 6.8-2.9 2.9-6.8-6.8zM12 9.5 4.2 17.3a1.6 1.6 0 0 0 2.3 2.3L14.4 12"/>',
  train: '<path d="M7 12h10"/><rect class="f" x="3" y="8" width="4" height="8" rx="1"/><rect class="f" x="17" y="8" width="4" height="8" rx="1"/><rect x="3" y="8" width="4" height="8" rx="1"/><rect x="17" y="8" width="4" height="8" rx="1"/><path d="M1.5 10.5v3M22.5 10.5v3"/>',
  eat: '<path class="f" d="M3.5 15.5c0-5 3.8-8.5 8.5-8.5s8.5 3.5 8.5 8.5c0 2-1 3.5-3 3.5h-11c-2 0-3-1.5-3-3.5z"/><path d="M3.5 15.5c0-5 3.8-8.5 8.5-8.5s8.5 3.5 8.5 8.5c0 2-1 3.5-3 3.5h-11c-2 0-3-1.5-3-3.5zM8.5 10.5l1.5 2.5M12 9.5l1.5 2.5M15.5 10.5 17 13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle class="f" cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.6"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/><circle cx="12" cy="12" r="6.5"/>',
  exit: '<path class="f" d="M5 3.5h8v17H5z"/><path d="M13 3.5H5v17h8M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5"/>',
  back: '<path d="M10 6 4 12l6 6M4.5 12H20"/>',
  play: '<path class="f" d="M7 4.5v15l12-7.5z"/><path d="M7 4.5v15l12-7.5z"/>',
  trash: '<path class="f" d="M6 7h12l-1 13H7z"/><path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 10.5v6M14 10.5v6"/>',
  board: '<rect class="f" x="4" y="12" width="4" height="8" rx="1"/><rect class="f" x="10" y="6" width="4" height="14" rx="1"/><rect class="f" x="16" y="9" width="4" height="11" rx="1"/><path d="M3 20.5h18"/><rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="6" width="4" height="14" rx="1"/><rect x="16" y="9" width="4" height="11" rx="1"/>',
  target: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  gift: '<rect class="f" x="4" y="10" width="16" height="10" rx="1"/><path d="M3 7h18v3H3zM4 10v10h16V10M12 7v13M12 7C10 3.5 6.5 4.5 7.5 7M12 7c2-3.5 5.5-2.5 4.5 0"/>',
  lock: '<rect class="f" x="5" y="10.5" width="14" height="10" rx="2"/><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5"/>',
  rocket: '<path class="f" d="M14.5 4.5c3-1 5-1 5-1s0 2-1 5l-6 6-4-4z"/><path d="M14.5 4.5c3-1 5-1 5-1s0 2-1 5l-6 6-4-4zM8.5 10.5 5 10l-2 2.5 4 1M13.5 15.5l.5 3.5-2.5 2-1-4M7 17c-1.5.5-2.5 2.5-2.5 2.5S6.5 18.5 7 17"/><circle cx="15.5" cy="8.5" r="1.3"/>',
  fist: '<path class="f" d="M7 11V7.5a1.5 1.5 0 0 1 3 0V7a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 6 14.5V13a2 2 0 0 1 2-2h2.5"/><path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V11M10 10.5V7a1.5 1.5 0 0 1 3 0v3.5M13 10.5v-3a1.5 1.5 0 0 1 3 0v3M16 10.5V8.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 6 14.5V13a2 2 0 0 1 2-2h2.5a1.5 1.5 0 0 1 0 3H9"/>',
  forward: '<path class="f" d="M3.5 6v12l8-6zM12 6v12l8-6z"/><path d="M3.5 6v12l8-6zM12 6v12l8-6z"/>',
  ad: '<rect class="f" x="3" y="5.5" width="18" height="12" rx="2"/><rect x="3" y="5.5" width="18" height="12" rx="2"/><path d="M8 21h8M10.5 9v5l4-2.5z"/>',
  factory: '<path class="f" d="M3 20V10.5l5 3v-3l5 3v-3l5 3V4h3v16z"/><path d="M3 20V10.5l5 3v-3l5 3v-3l5 3V4h3v16zM7 17h2M12 17h2M17 17h1"/>',
  camp: '<path class="f" d="M3 20 12 6l9 14z"/><path d="M3 20 12 6l9 14zM12 6V2.5l4 1.5-4 1.5M9.5 20l2.5-5 2.5 5"/>',
  hall: '<path class="f" d="M5 10h14v3a7 7 0 0 1-14 0z"/><path d="M3 10h18M5 10v3a7 7 0 0 0 14 0v-3M8 6.5c0-1 1-1 1-2M12 6.5c0-1 1-1 1-2M16 6.5c0-1 1-1 1-2"/>',
  map: '<path class="f" d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5zM9 4v13.5M15 6.5V20"/>',
  news: '<rect class="f" x="3.5" y="4.5" width="14" height="15" rx="1.5"/><path d="M17.5 8h3v10a1.5 1.5 0 0 1-3 0V6a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 6v12A1.5 1.5 0 0 0 5 19.5h13.5M6.5 8.5h8M6.5 12h8M6.5 15.5h5"/>',
  calendar: '<rect class="f" x="3.5" y="5" width="17" height="15" rx="2"/><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2M14 13.5h2M8 16.5h2"/>',
  house: '<path class="f" d="M5 10.5V20h14v-9.5L12 5z"/><path d="M3 11.5 12 4l9 7.5M5 10v10h14V10M9.5 20v-4.5h5V20"/>',
  bag: '<path class="f" d="M5 8h14l-1 12H6z"/><path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8"/>',
  help: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.7M12 17v.3"/>',
  save: '<path class="f" d="M5 4h11l3 3v13H5z"/><path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
  restore: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.5V9H9"/><path d="M12 8v4.5l3 2"/>',
  copy: '<rect class="f" x="8" y="8" width="12" height="12" rx="2"/><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  clock: '<circle class="f" cx="12" cy="12.5" r="8"/><circle cx="12" cy="12.5" r="8"/><path d="M12 8v4.5l3 2M9.5 2.5h5"/>',
  burst: '<path class="f" d="M12 2.5l2 5.5 5.5-2-2.5 5.5 5 2.5-5.5 2 1.5 5.5-5.5-3-3 5-1-5.5L3 19l2.5-5L2 11.5 7.5 10 6 4.5l5 3z"/><path d="M12 2.5l2 5.5 5.5-2-2.5 5.5 5 2.5-5.5 2 1.5 5.5-5.5-3-3 5-1-5.5L3 19l2.5-5L2 11.5 7.5 10 6 4.5l5 3z"/>',
  skull: '<path class="f" d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z"/><path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3zM10 20v-2.5M14 20v-2.5"/><circle cx="9" cy="11.5" r="1.7"/><circle cx="15" cy="11.5" r="1.7"/>',
  flame: '<path class="f" d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-4.3 3.6-6 4.3-10.8 2.8 1.8 3.7 4.3 3.4 6.4 1-.4 1.9-1.4 2.2-2.6 1.7 1.7 3.1 4 3.1 6.9 0 3.7-2.6 6.3-6.5 6.3z"/><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-4.3 3.6-6 4.3-10.8 2.8 1.8 3.7 4.3 3.4 6.4 1-.4 1.9-1.4 2.2-2.6 1.7 1.7 3.1 4 3.1 6.9 0 3.7-2.6 6.3-6.5 6.3z"/>',
  suitcase: '<rect class="f" x="3" y="7.5" width="18" height="12" rx="2"/><rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3 12.5h18"/>',
  tap: '<path class="f" d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l5 .8a2 2 0 0 1 1.7 2.3l-.9 5A2.5 2.5 0 0 1 15.3 20H11a3 3 0 0 1-2.4-1.2L5.5 14.6a1.5 1.5 0 0 1 2.3-1.9z"/><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l5 .8a2 2 0 0 1 1.7 2.3l-.9 5A2.5 2.5 0 0 1 15.3 20H11a3 3 0 0 1-2.4-1.2L5.5 14.6a1.5 1.5 0 0 1 2.3-1.9zM6 4.5 4.5 3M15 4.5 16.5 3M5 8H3"/>',
  crown: '<path class="f" d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z"/><path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10zM4.5 20.5h15"/>',
  gun: '<path class="f" d="M3 8h17v4h-8l-1 2H8l-1 5H3.5L5 12H3z"/><path d="M3 8h17v4h-8l-1 2H8l-1 5H3.5L5 12H3zM20 8V6.5M15 8V6.5"/>',
  plane: '<path class="f" d="M21 4.5 3 11l6.5 2.5L12 20l3.5-5 3.5 1.5z"/><path d="M21 4.5 3 11l6.5 2.5L12 20l3.5-5 3.5 1.5zM9.5 13.5 21 4.5"/>',
  star: '<path class="f" d="m12 3 2.7 5.6 6.1.8-4.4 4.2 1.1 6.1L12 16.8l-5.5 2.9 1.1-6.1-4.4-4.2 6.1-.8z"/><path d="m12 3 2.7 5.6 6.1.8-4.4 4.2 1.1 6.1L12 16.8l-5.5 2.9 1.1-6.1-4.4-4.2 6.1-.8z"/>',
  alarm: '<path class="f" d="M6.5 17v-5a5.5 5.5 0 0 1 11 0v5z"/><path d="M6.5 17v-5a5.5 5.5 0 0 1 11 0v5M4 20.5h16M4 17h16M12 2.5v2M4.5 5.5 6 7M19.5 5.5 18 7"/>',
  flag: '<path class="f" d="M5 4.5h12l-2.5 4 2.5 4H5z"/><path d="M5 21V4.5h12l-2.5 4 2.5 4H5"/>',
  unlock: '<rect class="f" x="5" y="10.5" width="14" height="10" rx="2"/><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.7-1.5M12 14.5v2.5"/>',
  ballot: '<rect class="f" x="4" y="11" width="16" height="9.5" rx="1.5"/><path d="M4 11h16v9.5H4zM8 11V4.5h8V11M10.2 7.8l1.3 1.3 2.4-2.6M8 15h8"/>',
  box: '<path class="f" d="M3.5 8 12 4l8.5 4v9L12 21l-8.5-4z"/><path d="M3.5 8 12 4l8.5 4v9L12 21l-8.5-4zM3.5 8 12 12l8.5-4M12 12v9"/>',
  wheat: '<path d="M12 21V8M12 11c-3 0-4-2.5-4-4.5 3 0 4 2.5 4 4.5zM12 11c3 0 4-2.5 4-4.5-3 0-4 2.5-4 4.5zM12 15.5c-3 0-4-2.5-4-4.5 3 0 4 2.5 4 4.5zM12 15.5c3 0 4-2.5 4-4.5-3 0-4 2.5-4 4.5zM12 7V3"/>',
  chain: '<path class="f" d="M9 15 15 9"/><path d="M10.5 6.5 12 5a4 4 0 0 1 5.7 5.7L16.2 12.2M13.5 17.5 12 19a4 4 0 0 1-5.7-5.7l1.5-1.5M9 15 15 9"/>',
  brick: '<rect class="f" x="3" y="6" width="18" height="12" rx="1"/><path d="M3 6h18v12H3zM3 10h18M3 14h18M9 6v4M15 10v4M9 14v4"/>',
  shield: '<path class="f" d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6z"/><path d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6zM8.8 12l2.3 2.3 4.3-4.6"/>',
  cross: '<circle class="f" cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  trophy: '<path class="f" d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11M12 14v3.5M8 20.5h8M9.5 17.5h5v3h-5z"/>',
  muscle: '<path class="f" d="M5 18c-1.5-3-1-8 1.5-11 1-1.2 2.5-1 3 .5L10 10c2.5-1.5 6-1 7.5 1.5 1.8 3-.2 6.5-3.5 6.5z"/><path d="M5 18c-1.5-3-1-8 1.5-11 1-1.2 2.5-1 3 .5L10 10c2.5-1.5 6-1 7.5 1.5 1.8 3-.2 6.5-3.5 6.5zM9.5 4.5 11 6.5"/>',
};

// Emoji in messages (toasts, news, battle notes) drawn as icons: emoji -> [icon, tint].
const EMOJI = {
  '💰': ['money', 'money'], '🪙': ['gold', 'gold'], '⚡': ['bolt', 'energy'], '🍞': ['eat', 'amber'], '🛒': ['market'],
  '🎯': ['target', 'amber'], '✊': ['fist'], '📰': ['news'], '🧳': ['suitcase', 'sky'], '🏋': ['train', 'violet'],
  '👆': ['tap', 'amber'], '🎖': ['medals', 'gold'], '⚔': ['war', 'red'], '🏗': ['factory'], '🏛': ['politics'], '👑': ['crown', 'gold'],
  '🎁': ['gift', 'gold'], '🚀': ['rocket', 'red'], '🔫': ['gun'], '👶': ['people', 'money'], '✈': ['plane', 'sky'], '⭐': ['star', 'gold'],
  '🚨': ['alarm', 'red'], '🏳': ['flag', 'gold'], '💀': ['skull', 'red'], '🔓': ['unlock', 'gold'], '🔒': ['lock'], '🛠': ['work', 'sky'],
  '📅': ['calendar'], '📋': ['news'], '🗳': ['ballot'], '📜': ['news'], '♻': ['restore', 'money'], '📦': ['box', 'amber'],
  '💪': ['muscle', 'violet'], '✨': ['star', 'amber'], '🏆': ['trophy', 'gold'], '🛡': ['shield', 'money'], '❌': ['cross', 'red'],
  '💔': ['cross', 'red'], '🏭': ['factory'], '🏠': ['house'], '🏡': ['house'], '🛖': ['house'], '🏘': ['house'], '🏰': ['house'],
  '🌾': ['wheat', 'amber'], '⛓': ['chain'], '🧱': ['brick', 'amber'], '🎒': ['bag'], '📺': ['ad', 'sky'], '🍽': ['hall', 'amber'],
  '✔': ['check', 'money'], '📊': ['board'], '🔥': ['flame', 'amber'], '☠': ['skull'], '💥': ['burst', 'amber'], '⏱': ['clock'],
};
const EMOJI_RE = new RegExp(`(${Object.keys(EMOJI).join('|')})\\uFE0F?`, 'gu');

// Replaces the known emoji of an already escaped HTML string with icons.
export function iconize(html) {
  return String(html).replace(EMOJI_RE, (m, e) => ico(...EMOJI[e]));
}

// An icon as an inline SVG string; tint: an .ic-<tint> colour class (gold, green, energy…).
export function ico(name, tint = '') {
  const body = S[name];
  if (!body) return '';
  return `<svg class="ic${tint ? ` ic-${tint}` : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Static markup marks icons with <i data-ic="name" data-tint="…"></i>.
export function drawIcons(root = document) {
  root.querySelectorAll('[data-ic]').forEach((el) => { el.innerHTML = ico(el.dataset.ic, el.dataset.tint || ''); });
}

export const ICON_NAMES = Object.keys(S);
