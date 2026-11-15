/* PRN ASM — Offline interactive presentation built with React (local UMD runtime).
   All on-slide verbal content is grounded in the 18-page Canva presentation.
   The visual UI, CSS animations and Sudoku illustrations are original. */
(function(){
'use strict';
const R=window.React, RD=window.ReactDOM;
const h=R.createElement;
const C=(name,props,...children)=>h(name,props,...children);
const DIV=(props,...children)=>h('div',props,...children);
const SP=(props,...children)=>h('span',props,...children);
const P=(props,...children)=>h('p',props,...children);
const H2=(props,...children)=>h('h2',props,...children);
const H3=(props,...children)=>h('h3',props,...children);
const B=(props,...children)=>h('b',props,...children);
const small=(text)=>SP({className:'small'},text);
const cx=(...parts)=>parts.filter(Boolean).join(' ');
const iconPaths={
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt:'<path d="m13 2-3 8H4l9 12 2-9h5L13 2z"/>',
  layers:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>',
  server:'<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  radio:'<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.48M7.76 7.76a6 6 0 0 0 0 8.48M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 9h6v6H9zM9 1v5M15 1v5M9 18v5M15 18v5M1 9h5M1 15h5M18 9h5M18 15h5"/>',
  trophy:'<path d="M8 21h8M12 17v4M7 3h10v8a5 5 0 0 1-10 0V3zM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4"/>',
  arrow:'<path d="M4 12h16m-7-7 7 7-7 7"/>',
  check:'<path d="m5 12 5 5L20 7"/>',
  link:'<path d="M10 13a5 5 0 0 0 8 1l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-8-1l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  orbit:'<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-35 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(35 12 12)"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  cloud:'<path d="M20 16.5A4.5 4.5 0 0 0 18 8h-1a6 6 0 0 0-11 2 4 4 0 0 0 0 8h13"/>',
  hex:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5z"/>',
  terminal:'<rect x="2" y="3" width="20" height="18" rx="3"/><path d="m6 9 3 3-3 3M12 16h5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15"/>',
  play:'<path d="m8 5 11 7-11 7V5z"/>',
  pulse:'<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  bracket:'<path d="M9 3H5v18h4M15 3h4v18h-4M11 9l2 3-2 3"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  star:'<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  fire:'<path d="M12 22c-5 0-8-3-8-7 0-3 1-5 4-8 0 3 2 4 2 4 1-4 2-7 4-9 1 5 6 8 6 13 0 4-3 7-8 7z"/>',
  repeat:'<path d="M20 7h-9m9 0-3-3m3 3-3 3M4 17h9m-9 0 3-3m-3 3 3 3"/>'
};
function Ico({name='grid',size=22,className=''}) {return h('svg',{className:cx('i',className),width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round',dangerouslySetInnerHTML:{__html:iconPaths[name]||iconPaths.grid}})}
const solution=[
[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
[8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
[9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
];
const givens=new Set([0,1,4,8,9,12,13,14,17,19,20,24,26,28,31,34,36,38,40,42,44,46,49,52,54,56,60,61,63,66,67,68,71,72,76,79,80]);
function SudokuBoard({small=false,ghost=false,variant='a'}){return DIV({className:cx('sudoku',small&&'sudoku-small',ghost&&'sudoku-ghost','variant-'+variant)},
 DIV({className:'sudoku-grid'},...solution.flatMap((row,r)=>row.map((d,c)=>{const idx=r*9+c,visible=givens.has(idx)||((variant==='b')&&[3,11,33,50,57,77].includes(idx));return DIV({key:idx,className:cx('cell',c%3===2&&c!==8&&'right-heavy',r%3===2&&r!==8&&'bottom-heavy',idx===40&&'focus-cell',idx===39&&'hint-cell',visible&&'given')},visible?String(d):'')}))) );}
function BrandIcon({name,size=44}){
 let key=name.toLowerCase();
 let inner;
 const text=(s,background,color='#fff',fontSize=18)=>DIV({className:'brand-letter',style:{background,color,fontSize,width:size,height:size}},s);
 if(key.includes('react')&&!key.includes('router')){inner=DIV({className:'brand-react',style:{width:size,height:size}},h('svg',{viewBox:'0 0 100 100'},h('circle',{cx:50,cy:50,r:7,fill:'#6ce2fc'}),...[0,60,120].map(a=>h('ellipse',{key:a,cx:50,cy:50,rx:43,ry:16,stroke:'#6ce2fc',strokeWidth:4.5,fill:'none',transform:`rotate(${a} 50 50)`}))));}
 else if(key.includes('typescript')) inner=text('TS','#3178c6','#fff',21);
 else if(key==='vite 8'||key.includes('vite'))inner=text('◢','linear-gradient(135deg,#b255ff,#fbd461)', '#fff',39);
 else if(key.includes('router'))inner=text('RR','#ed5a69','#fff',19);
 else if(key.includes('firebase'))inner=DIV({className:'brand-flame',style:{width:size,height:size}},h('svg',{viewBox:'0 0 50 54',width:size,height:size},h('path',{d:'M8 40 14 5l9 12 5-8 15 31L26 51Z',fill:'#ffa000'}),h('path',{d:'m8 40 20-31 15 31-17 11Z',fill:'#fbbc05'}),h('path',{d:'M8 40 14 5l10 20Z',fill:'#ff6f00'})));
 else if(key.includes('connect'))inner=text('↔','linear-gradient(135deg,#0e7fea,#18d7f6)','#fff',30);
 else if(key==='grpc'||key.includes('grpc-web'))inner=text('g','linear-gradient(135deg,#1386de,#06478d)','#fff',30);
 else if(key.includes('protobuf'))inner=text('P','linear-gradient(135deg,#5380ed,#2f42ad)','#fff',27);
 else if(key.includes('signalr'))inner=text('⌁','linear-gradient(135deg,#8e5dff,#4d58dd)','#fff',38);
 else if(key.includes('envoy'))inner=text('E','linear-gradient(135deg,#5e5eae,#9e71dc)','#fff',26);
 else if(key.includes('buf'))inner=text('B','#0a8c88','#fff',28);
 else if(key.includes('.net')||key.includes('asp.net')||key.includes('c#'))inner=text('.NET','linear-gradient(135deg,#7342d0,#a36cff)','#fff',16);
 else if(key.includes('postgres'))inner=text('PG','linear-gradient(135deg,#37688e,#74a5c4)','#fff',19);
 else if(key.includes('redis'))inner=text('R','#d92b34','#fff',27);
 else if(key.includes('kafka'))inner=text('K','#334254','#fff',26);
 else if(key.includes('docker'))inner=text('▤','#168be3','#fff',30);
 else if(key.includes('telemetry'))inner=text('OT','#5d55c7','#fff',21);
 else if(key.includes('ef core'))inner=text('EF','#6374ad','#fff',21);
 else if(key.includes('xunit'))inner=text('xU','#344960','#fff',22);
 else inner=text(name.slice(0,2).toUpperCase(),'linear-gradient(135deg,#173855,#168cb2)','#fff',21);
 return DIV({className:'brand-icon',style:{'--sz':size+'px'}},inner);
}
const Footer=({num,light=false,text='SUDOKU ONLINE  •  PRN ASM'})=>DIV({className:cx('slide-footer',light&&'light')},
 SP({className:'footer-line'}),SP({className:'footer-name'},text),SP({className:'footer-index'},String(num).padStart(2,'0'),SP({className:'dim'},' / 18')));
const Header=({label='PRN ASM',right='',invert=false})=>DIV({className:cx('slide-header',invert&&'invert')},
 DIV({className:'header-brand'},DIV({className:'brand-mini'},'P'),SP(null,label)),right?SP({className:'header-right'},right):null);
const Title=({label,kicker,wide=false})=>DIV({className:'title-wrap'},kicker?DIV({className:'kicker'},DIV({className:'kicker-line'}),kicker):null,H2({className:cx('slide-title',wide&&'wide')},label));
const Chip=({icon,label,accent='cyan'})=>DIV({className:cx('chip','chip-'+accent)},Ico({name:icon,size:20}),SP(null,label));
const Panel=({className='',children,style})=>DIV({className:cx('panel',className),style},children);
function SlideCover(){
 const copy=DIV({className:'cover-copy'},
   DIV({className:'eyebrow'},DIV({className:'status-pulse'}),'PRN ASM'),
   H2({className:'cover-title'},'SUDOKU',h('br'),SP({className:'gradient-text'},'ONLINE')),
   DIV({className:'cover-rule'}),
   P({className:'cover-sub'},'SOLO · REALTIME MULTIPLAYER · EVENT-DRIVEN MICROSERVICES'),
   DIV({className:'cover-pills'},Chip({icon:'grid',label:'SOLO',accent:'cyan'}),Chip({icon:'radio',label:'1V1',accent:'violet'}))
 );
 const art=DIV({className:'cover-art'},
   DIV({className:'orbit orbit-1'}),DIV({className:'orbit orbit-2'}),
   DIV({className:'board-float'},SudokuBoard({variant:'a'})),
   DIV({className:'cover-float float-a'},Ico({name:'pulse',size:25})),
   DIV({className:'cover-float float-b'},Ico({name:'bolt',size:27}))
 );
 return DIV({className:'slide-inner slide-cover'},
   Header({label:'PRN ASM',right:'11.11.2026'}),
   DIV({className:'cover-grid'},copy,art),
   Footer({num:1,text:'SUDOKU ONLINE  •  PRN ASM'})
 );
}
const members=[['NGUYỄN DUY PHONG','SE192969'],['PHẠM GIA HUY','SE192867'],['MAI TUẤN VỸ','SE194261'],['NGUYỄN TUẤN KIỆT','SE192837']];
function SlideTeam(){return DIV({className:'slide-inner'},Header({label:'PRN ASM',right:'THÀNH VIÊN NHÓM'}),Title({label:'THÀNH VIÊN NHÓM',kicker:'02 / OUR TEAM'}),
 DIV({className:'team-layout'},DIV({className:'team-deco'},DIV({className:'team-halo'},Ico({name:'users',size:130})),DIV({className:'team-vert'},'PRN ASM')),
 DIV({className:'team-cards'},...members.map(([name,id],i)=>Panel({className:'team-card',children:DIV({className:'team-card-content'},
 DIV({className:'member-avatar'},SP(null,String(i+1).padStart(2,'0'))),DIV({className:'member-text'},H3(null,name),DIV({className:'member-id'},id)),DIV({className:'member-ornament'},Ico({name:'hex',size:23}))) })))),Footer({num:2}));}
function SlideOverview(){let group1=['Luyện tập theo độ khó','Bảng Standard / Irregular','Ghi chú, gợi ý và tính điểm'],group2=['Race và Duel thời gian thực','4 microservices .NET','Firebase Auth · Protobuf · SignalR'];return DIV({className:'slide-inner'},Header({label:'PRN ASM'}),Title({label:'TỔNG QUAN DỰ ÁN',kicker:'03 / PRODUCT OVERVIEW'}),
 DIV({className:'overview-layout'},Panel({className:'overview-card solo-card',children:DIV(null,DIV({className:'card-heading'},Ico({name:'grid',size:34}),H3(null,'SOLO')),DIV({className:'ov-list'},...group1.map((x,i)=>DIV({className:'ov-line',key:i},Ico({name:'check',size:20}),x))),DIV({className:'overview-ghost-grid'},SudokuBoard({small:true,ghost:true})))}),
 Panel({className:'overview-card duo-card',children:DIV(null,DIV({className:'card-heading'},Ico({name:'radio',size:34}),H3(null,'MULTIPLAYER 1V1')),DIV({className:'ov-list'},...group2.map((x,i)=>DIV({className:'ov-line',key:i},Ico({name:'check',size:20}),x))),DIV({className:'overview-net'},...[0,1,2,3,4].map(i=>DIV({key:i,className:'netnode net-'+i}))))})), Footer({num:3}));}
const featureLeft=['Firebase Authentication và hồ sơ người chơi','Solo: cấp độ, note, gợi ý, lỗi, điểm, thời gian','Multiplayer: matchmaking, custom room, Race và Duel','SignalR đồng bộ nước đi và tiến độ','Backend API: xếp hạng, lịch sử, tutorial, luật chơi'];
const featureRight=['Bảng xếp hạng & lịch sử','Nhiệm vụ & giải đấu','Luật chơi, hướng dẫn & thông báo','Quản trị hệ thống'];
function SlideFeatures(){const lIcon=['shield','grid','users','radio','database'],rIcon=['trophy','target','bell','server'];return DIV({className:'slide-inner'},Header({label:'PRN / ASM',right:'FEATURES'}),Title({label:'Các chức năng của hệ thống',kicker:'04 / FEATURES'}),
 DIV({className:'feature-layout'},Panel({className:'features-panel left-features',children:DIV(null,DIV({className:'panel-top'},Ico({name:'pulse',size:25}),B(null,'GAMEPLAY & REALTIME')),...featureLeft.map((x,i)=>DIV({className:'feature-item',key:i},DIV({className:'feature-icon'},Ico({name:lIcon[i],size:23})),SP(null,x))))}),
 Panel({className:'features-panel',children:DIV(null,DIV({className:'panel-top violet'},Ico({name:'layers',size:25}),B(null,'TIỆN ÍCH & QUẢN LÝ')),P({className:'feature-sublabel'},'Các nhóm chức năng bổ trợ'),...featureRight.map((x,i)=>DIV({className:'feature-item',key:i},DIV({className:'feature-icon violet'},Ico({name:rIcon[i],size:23})),SP(null,x))))})),Footer({num:4,text:'SUDOKU ONLINE  ·  REALTIME MULTIPLAYER'}));}
const soloSteps=['Chọn độ khó, kiểu bảng','Lấy hoặc sinh puzzle','Kiểm tra nước đi trên server','Note và các phương pháp gợi ý','Tính điểm, thời gian; lưu game_db'];
function SlideSolo(){return DIV({className:'slide-inner'},Header({label:'PRN ASM'}),Title({label:'CHẾ ĐỘ SOLO',kicker:'05 / GAMEPLAY'}),
 DIV({className:'solo-layout'},DIV({className:'solo-steps'},...soloSteps.map((x,i)=>Panel({className:'solo-step',children:DIV({className:'step-row'},DIV({className:'step-num'},String(i+1).padStart(2,'0')),SP(null,x),i===4?Ico({name:'check',size:21}):null)}))),
 DIV({className:'solo-visual'},DIV({className:'solo-visual-bg'}),SudokuBoard({variant:'b'}),DIV({className:'solo-marker'},Ico({name:'target',size:24})))), Footer({num:5}));}
function SlideMultiplayer(){const a=['Ghép trận tự động hoặc phòng bằng mã. Hai thể thức: Race và Duel.','SignalR / WebSocket đồng bộ nước đi, tiến độ và kết nối.','Redis lưu runtime; PostgreSQL lưu kết quả; Kafka truyền MatchCompleted.'];return DIV({className:'slide-inner'},Header({label:'PRN ASM'}),Title({label:'MULTIPLAYER 1V1',kicker:'06 / REALTIME 1V1'}),
 DIV({className:'duel-stage'},DIV({className:'duel-box left'},SudokuBoard({small:true,variant:'a'})),DIV({className:'duel-center'},DIV({className:'duel-ring'},'VS'),DIV({className:'duel-beam'})),DIV({className:'duel-box right'},SudokuBoard({small:true,variant:'b'}))),
 DIV({className:'multi-details'},...a.map((x,i)=>Panel({className:'multi-desc',children:DIV(null,DIV({className:'multi-num'},String(i+1).padStart(2,'0')+'.'),P(null,x))}))),Footer({num:6}));}
const services=[['G','GAME SERVICE','Quản lý puzzle, phiên Solo, logic nước đi, hint, điểm cao.','grid'],['U','USER SERVICE','Quản lý hồ sơ người chơi theo Firebase UID.','users'],['M','MULTIPLAYER SERVICE','Matchmaking, MatchHub SignalR, Elo, lịch sử trận.','radio'],['S','SUPPORT SERVICE','Cung cấp luật chơi, nội dung hướng dẫn và thông báo.','layers']];
function SlideServices(){return DIV({className:'slide-inner'},Header({label:'PRN / ASM',right:'SERVICE RESPONSIBILITIES'}),Title({label:'4 backend microservices',kicker:'07 / MICROSERVICES'}),
 DIV({className:'service-grid'},...services.map(([letter,name,desc,icon],i)=>Panel({className:cx('service-card','sv-'+i),children:DIV({className:'service-row'},DIV({className:'service-sigil'},Ico({name:icon,size:36}),SP({className:'service-letter'},letter)),DIV({className:'service-copy'},H3(null,name),P(null,desc)),DIV({className:'service-corner'},Ico({name:'arrow',size:23})))}))),
 DIV({className:'service-principle'},Ico({name:'link',size:22}),SP(null,'Nguyên tắc: mỗi service sở hữu nghiệp vụ và dữ liệu của chính mình.')),Footer({num:7,text:'SUDOKU ONLINE  ·  REALTIME MULTIPLAYER'}));}
const frontendTech=['React 19','TypeScript 6','Vite 8','React Router','Firebase Auth','ConnectRPC Web','gRPC','Protobuf'];
const frontendExtra=[['Envoy Proxy','Envoy Proxy: gRPC-Web, CORS và routing'],['SignalR','SignalR: cập nhật trận theo WebSocket'],['Buf CLI','Buf CLI: sinh mã từ file .proto']];
function SlideFrontend(){return DIV({className:'slide-inner'},Header({label:'PRN ASM'}),Title({label:'FRONTEND & API',kicker:'08 / TECHNOLOGY STACK'}),
 DIV({className:'frontend-grid'},...frontendTech.map((x,i)=>Panel({className:'tech-card',children:DIV({className:'tech-card-content'},BrandIcon({name:x,size:60}),SP({className:'tech-name'},x),DIV({className:'tech-dot'}))}))),
 DIV({className:'frontend-extra'},...frontendExtra.map(([n,x])=>Panel({className:'extra-card',children:DIV({className:'extra-content'},BrandIcon({name:n,size:47}),P(null,x))}))),Footer({num:8}));}
const backTech=['EF Core / Npgsql','PostgreSQL 16','Redis 7','Apache Kafka 3.9','Docker / Docker Compose','OpenTelemetry','xUnit'];
function SlideBackend(){return DIV({className:'slide-inner'},Header({label:'PRN ASM'}),Title({label:'BACKEND & DATA',kicker:'09 / TECHNOLOGY STACK'}),
 DIV({className:'backend-banner'},BrandIcon({name:'.NET',size:72}),SP(null,'4 microservices dùng .NET 8 / ASP.NET Core và C# 12.')),
 DIV({className:'backend-grid'},...backTech.map((x,i)=>Panel({className:'backend-tech',children:DIV({className:'backend-tech-inner'},BrandIcon({name:x,size:63}),SP(null,x))}))),Footer({num:9}));}
const authSteps=['React đăng nhập qua Firebase Auth','Firebase cung cấp ID Token','ConnectRPC gắn Bearer token','Envoy định tuyến request gRPC-Web','Backend xác thực JWT, lấy Firebase UID'];
const authIcon=['users','shield','link','globe','lock'];
function SlideAuth(){return DIV({className:'slide-inner'},Header({label:'PRN ASM'}),Title({label:'LUỒNG API & AUTH',kicker:'10 / AUTHENTICATION'}),
 DIV({className:'auth-timeline'},DIV({className:'auth-line'}),...authSteps.map((x,i)=>DIV({className:'auth-item'},DIV({className:'auth-node'},Ico({name:authIcon[i],size:28})),DIV({className:'auth-num'},String(i+1).padStart(2,'0')),P(null,x)))),
 DIV({className:'auth-visual'},DIV({className:'auth-orb orb-a'},BrandIcon({name:'Firebase Auth',size:80})),DIV({className:'auth-arrow'},Ico({name:'arrow',size:45})),DIV({className:'auth-orb orb-b'},BrandIcon({name:'Envoy Proxy',size:80}))),Footer({num:10}));}
const soloFlow=[['StartGame','Client gọi API qua Envoy'],['Sudoku Core','Lấy hoặc sinh puzzle'],['game_db','EF Core lưu session'],['MakeMove / UseHint','Cập nhật lỗi, điểm, thời gian'],['GameFinished','Ghi sự kiện vào Outbox']];
function SlideSoloFlow(){return DIV({className:'slide-inner'},Header({label:'PRN / ASM',right:'SOLO FLOW'}),Title({label:'Luồng Solo & ghi dữ liệu',kicker:'11 / BUSINESS FLOW 01'}),
 DIV({className:'flow-steps'},...soloFlow.map(([name,desc],i)=>DIV({className:'flow-segment'},Panel({className:'flow-card',children:DIV(null,DIV({className:'flow-count'},String(i+1).padStart(2,'0')),H3(null,name),P(null,desc))}),i!==soloFlow.length-1?DIV({className:'flow-link'},Ico({name:'arrow',size:24})):null))),
 DIV({className:'flow-note'},Ico({name:'database',size:23}),SP(null,'Kết thúc phiên: GameFinished được ghi vào bảng Outbox trong giao dịch dữ liệu.')),Footer({num:11,text:'SUDOKU ONLINE  ·  REALTIME MULTIPLAYER'}));}
const multiFlow=[['KẾT NỐI','WebSocket SignalR qua Envoy'],['MATCHMAKING','Queue / phòng tùy chỉnh'],['PUZZLE','Game Service cấp bảng chung'],['BROADCAST','MatchHub phát move / progress'],['REDIS','Lưu snapshot & Elo cache'],['POSTGRESQL','Lưu kết quả / rating'],['KAFKA','Outbox → MatchCompleted']];
function SlideMultiFlow(){return DIV({className:'slide-inner'},Header({label:'PRN / ASM',right:'BUSINESS FLOW 02'}),Title({label:'Luồng Multiplayer & Kafka',kicker:'12 / BUSINESS FLOW 02'}),
 DIV({className:'mflow-grid'},...multiFlow.map(([name,desc],i)=>Panel({className:cx('mflow-card','mf-'+i),children:DIV(null,DIV({className:'mflow-n'},String(i+1).padStart(2,'0')),H3(null,name),P(null,desc))}))),Footer({num:12,text:'SUDOKU ONLINE  ·  REALTIME MULTIPLAYER'}));}
function SlideDeploy(){return DIV({className:'slide-inner'},Header({label:'PRN ASM'}),Title({label:'DEPLOY & VẬN HÀNH',kicker:'13 / OPERATIONS'}),
 DIV({className:'deploy-cols'},Panel({className:'deploy-card',children:DIV(null,DIV({className:'deploy-label'},Ico({name:'server',size:25}),'MÔI TRƯỜNG CHẠY'),
 P({className:'deploy-copy'},'Docker Compose trên máy local / self-hosted.'),P({className:'deploy-copy'},'Envoy: cổng host 18080 → container 8080.'),DIV({className:'deploy-logo-strip'},BrandIcon({name:'Docker',size:54}),BrandIcon({name:'PostgreSQL 16',size:54}),BrandIcon({name:'Redis 7',size:54}))) }),
 Panel({className:'deploy-card deploy-right',children:DIV(null,DIV({className:'deploy-label'},Ico({name:'cloud',size:25}),'PHƯƠNG ÁN TRIỂN KHAI PUBLIC'),
 P({className:'deploy-copy'},'Backend: VPS Ubuntu + Docker Compose.'),P({className:'deploy-copy'},'Frontend: Firebase Hosting hoặc Vercel.'),P({className:'deploy-copy'},'HTTPS proxy, bảo vệ secrets và backup.'),DIV({className:'deploy-logo-strip'},BrandIcon({name:'Docker',size:54}),BrandIcon({name:'Firebase Auth',size:54}),BrandIcon({name:'Envoy Proxy',size:54}))) })),Footer({num:13}));}
const diagramTitles=['Kiến trúc tổng thể','Firebase Authentication','Luồng chơi Solo','Multiplayer realtime','Kafka & Deployment'];
function SlideDiagram({i}){return DIV({className:'slide-inner diagram-slide'},Header({label:'PRN ASM'}),DIV({className:'diagram-heading'},DIV({className:'kicker'},DIV({className:'kicker-line'}),'DIAGRAM 0'+(i+1)),H2({className:'diagram-title'},diagramTitles[i])),DIV({className:'diagram-blank'},DIV({className:'diagram-corner corner-tl'}),DIV({className:'diagram-corner corner-tr'}),DIV({className:'diagram-corner corner-bl'}),DIV({className:'diagram-corner corner-br'})),Footer({num:14+i,text:'PRN ASM'}));}
const slides=[SlideCover,SlideTeam,SlideOverview,SlideFeatures,SlideSolo,SlideMultiplayer,SlideServices,SlideFrontend,SlideBackend,SlideAuth,SlideSoloFlow,SlideMultiFlow,SlideDeploy,...diagramTitles.map((_,i)=>function(){return SlideDiagram({i})})];
const slideTitles=['SUDOKU ONLINE','THÀNH VIÊN NHÓM','TỔNG QUAN DỰ ÁN','Các chức năng của hệ thống','CHẾ ĐỘ SOLO','MULTIPLAYER 1V1','4 backend microservices','FRONTEND & API','BACKEND & DATA','LUỒNG API & AUTH','Luồng Solo & ghi dữ liệu','Luồng Multiplayer & Kafka','DEPLOY & VẬN HÀNH',...diagramTitles];
const uiIcon={arrowRight:'→',arrowLeft:'←',full:'⤢',grid:'▦',help:'?',close:'×'};
class Presentation extends R.Component{
 constructor(p){super(p);const hash=Number(location.hash.replace('#',''));this.state={index:Number.isFinite(hash)&&hash>=1&&hash<=18?hash-1:0,overview:false,help:false,scale:1,controls:true};this.touchStart=null;this.lastWheel=0;this.keyHandler=this.handleKey.bind(this);this.resizer=this.resize.bind(this);this.wheeler=this.wheel.bind(this)}
 componentDidMount(){window.addEventListener('keydown',this.keyHandler);window.addEventListener('resize',this.resizer);window.addEventListener('wheel',this.wheeler,{passive:false});window.addEventListener('hashchange',()=>{let n=Number(location.hash.slice(1));if(n>=1&&n<=18)this.setState({index:n-1})});this.resize();}
 componentWillUnmount(){window.removeEventListener('keydown',this.keyHandler);window.removeEventListener('resize',this.resizer);window.removeEventListener('wheel',this.wheeler)}
 resize(){const w=window.innerWidth,h=window.innerHeight;let scale=Math.min(w/1600,h/900);this.setState({scale})}
 go(delta){this.setState(s=>{let index=Math.max(0,Math.min(17,s.index+delta));if(index!==s.index)window.history.replaceState(null,'','#'+(index+1));return {index,overview:false,help:false}})}
 goto(index){window.history.replaceState(null,'','#'+(index+1));this.setState({index,overview:false,help:false})}
 handleKey(e){const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='TEXTAREA')return;const k=e.key;if(['ArrowRight','ArrowDown',' ','PageDown','Enter'].includes(k)&&!this.state.overview&&!this.state.help){e.preventDefault();this.go(1);}else if(['ArrowLeft','ArrowUp','PageUp','Backspace'].includes(k)&&!this.state.overview&&!this.state.help){e.preventDefault();this.go(-1);}else if(k==='Home'){e.preventDefault();this.goto(0)}else if(k==='End'){e.preventDefault();this.goto(17)}else if(k.toLowerCase()==='o'){this.setState(s=>({overview:!s.overview,help:false}))}else if(k.toLowerCase()==='f'){this.fullscreen()}else if(k==='?'||k.toLowerCase()==='h'){this.setState(s=>({help:!s.help,overview:false}))}else if(k==='Escape'){this.setState({help:false,overview:false})}}
 wheel(e){if(Math.abs(e.deltaY)<18||this.state.overview)return;const t=Date.now();if(t-this.lastWheel<650)return;this.lastWheel=t;this.go(e.deltaY>0?1:-1)}
 fullscreen(){if(!document.fullscreenElement){document.documentElement.requestFullscreen?.()}else{document.exitFullscreen?.()}}
 render(){const {index,scale,overview,help}=this.state;const Active=slides[index];return DIV({className:'presentation-shell',onTouchStart:e=>{this.touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},onTouchEnd:e=>{if(!this.touchStart)return;let dx=e.changedTouches[0].clientX-this.touchStart.x;if(Math.abs(dx)>75)this.go(dx<0?1:-1);this.touchStart=null}},
 DIV({className:'stage',style:{transform:`translate(-50%,-50%) scale(${scale})`}},DIV({className:'slide-canvas',key:index},h(Active,{}))),
 DIV({className:'app-topline'},DIV({className:'live-dot'}),SP(null,'PRN ASM'),DIV({className:'app-divider'}),SP({className:'app-top-muted'},'SUDOKU ONLINE')),
 DIV({className:'app-bottom'},DIV({className:'nav-controls'},h('button',{title:'Slide trước (←)',onClick:()=>this.go(-1),disabled:index===0,className:'nav-btn'},uiIcon.arrowLeft),h('button',{title:'Slide tiếp theo (→)',onClick:()=>this.go(1),disabled:index===17,className:'nav-btn active-nav'},uiIcon.arrowRight)),DIV({className:'progress-zone'},DIV({className:'progress-rail'},DIV({className:'progress-current',style:{width:(index+1)/18*100+'%'}})),SP({className:'progress-numbers'},String(index+1).padStart(2,'0')+' / 18')),DIV({className:'nav-tools'},h('button',{title:'Xem tổng quan (O)',onClick:()=>this.setState({overview:!overview,help:false}),className:cx('tool-btn',overview&&'selected')},'▦'),h('button',{title:'Trợ giúp phím tắt (?)',onClick:()=>this.setState({help:!help,overview:false}),className:'tool-btn'},'?'),h('button',{title:'Toàn màn hình (F)',onClick:()=>this.fullscreen(),className:'tool-btn'},'⤢'))),
 overview?DIV({className:'modal-backdrop',onClick:()=>this.setState({overview:false})},DIV({className:'overview-modal',onClick:e=>e.stopPropagation()},DIV({className:'modal-head'},B(null,'18 slides · PRN ASM'),h('button',{onClick:()=>this.setState({overview:false})},'×')),DIV({className:'slide-picker'},...slideTitles.map((name,i)=>DIV({className:cx('slide-thumb',i===index&&'current'),onClick:()=>this.goto(i),key:i},SP({className:'thumb-n'},String(i+1).padStart(2,'0')),SP({className:'thumb-name'},name),DIV({className:'thumb-bar'})) )))):null,
 help?DIV({className:'modal-backdrop',onClick:()=>this.setState({help:false})},DIV({className:'help-modal',onClick:e=>e.stopPropagation()},DIV({className:'modal-head'},B(null,'Điều khiển trình chiếu'),h('button',{onClick:()=>this.setState({help:false})},'×')),DIV({className:'help-list'},...[['→ / Space','Slide tiếp theo'],['← / Backspace','Slide trước'],['Home / End','Đến đầu / cuối'],['O','Xem tất cả 18 slide'],['F','Toàn màn hình'],['Esc','Đóng bảng này']].map(([k,v])=>DIV({className:'help-row'},SP({className:'keycap'},k),SP(null,v)))))):null
 );}
}
RD.render(h(Presentation),document.getElementById('root'));
})();
