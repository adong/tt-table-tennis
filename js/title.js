/* The game's name, in one place. The page title, the logo and the results card all come from here.
   Text before a colon is the big line of the logo, the rest is the small line ('TT' / 'Table Tennis').
   The pun: TT = Teddy & Tommy = table tennis (乒乓球). */
window.TT_TITLE = 'TT: Table Tennis';
if (typeof document !== 'undefined') document.title = window.TT_TITLE.replace(':', '');
