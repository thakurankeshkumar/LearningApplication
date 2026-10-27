import React, { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Compass, Trophy, Settings, LogOut, Bell, Search, ArrowRight, Play, Flame, Target, Clock3, CheckCircle2, LockKeyhole, Menu, X, Plus, Users, GraduationCap, Languages } from 'lucide-react';

const API = 'http://localhost:5000/api';
const money = p => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format((p||0)/100);
function useAuth() {
  const [token,setToken] = useState(localStorage.getItem('lp_token') || '');
  const [user,setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('lp_user')||'null'); } catch { return null; } });
  const logout = () => { localStorage.removeItem('lp_token'); localStorage.removeItem('lp_user'); setToken(''); setUser(null); };
  const login = (data) => { localStorage.setItem('lp_token',data.token); localStorage.setItem('lp_user',JSON.stringify(data.user)); setToken(data.token); setUser(data.user); };
  return { token,user,login,logout };
}
function App() {
  const auth = useAuth();
  const [courses,setCourses] = useState([]);
  const [dashboard,setDashboard] = useState(null);
  const [notice,setNotice] = useState('');
  const [mobileOpen,setMobileOpen] = useState(false);
  const [search,setSearch] = useState('');
  const [authMode,setAuthMode] = useState('login');
  const [authForm,setAuthForm] = useState({name:'',email:'student@lingopro.local',password:'Student123!'});
  const [adminForm,setAdminForm] = useState({title:'',language:'English',level:'Beginner',priceRupees:'0',description:'',published:true});
  const [adminOverview,setAdminOverview] = useState(null);
  const [students,setStudents] = useState([]);
  const [busy,setBusy] = useState(false);
  const navigate = useNavigate();
  const request = async (path, options={}) => {
    const r = await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(auth.token?{Authorization:`Bearer ${auth.token}`} : {}),...(options.headers||{})}});
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  };
  const refresh = async () => {
    try { const c=await request('/courses'); setCourses(c.courses); } catch(e) { setNotice(e.message); }
    if(auth.token) {
      try { setDashboard(await request('/dashboard')); } catch {}
      if(auth.user?.role==='admin') {
        try { setAdminOverview(await request('/admin/overview')); setStudents((await request('/admin/students')).students); } catch {}
      }
    } else setDashboard(null);
  };
  useEffect(()=>{ refresh(); },[auth.token,auth.user?.role]);
  const notify = msg => { setNotice(msg); window.setTimeout(()=>setNotice(''),4000); };
  const submitAuth = async e => {
    e.preventDefault(); setBusy(true);
    try {
      const data=await request(`/auth/${authMode}`,{method:'POST',body:JSON.stringify(authForm)});
      auth.login(data); notify(`Welcome ${data.user.name.split(' ')[0]}!`); navigate('/dashboard');
    } catch(e) { notify(e.message); } finally { setBusy(false); }
  };
  const enroll = async id => {
    if(!auth.token) { navigate('/login'); return; }
    try { await request(`/enrollments/${id}`,{method:'POST'}); notify('Enrolled successfully!'); refresh(); }
    catch(e) { notify(e.message); }
  };
  const createCourse = async e => {
    e.preventDefault();
    try { await request('/admin/courses',{method:'POST',body:JSON.stringify(adminForm)}); notify('Course created.'); setAdminForm({...adminForm,title:'',description:''}); refresh(); }
    catch(e) { notify(e.message); }
  };
  const nav = [
    {to:'/',label:'Overview',icon:LayoutDashboard},
    {to:'/courses',label:'Explore courses',icon:Compass},
    ...(auth.token?[{to:'/dashboard',label:'My learning',icon:BookOpen}]:[]),
    ...(auth.user?.role==='admin'?[{to:'/admin',label:'Admin studio',icon:Settings}]:[])
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen?'open':''}`}>
      <Link to="/" className="brand" onClick={()=>setMobileOpen(false)}><span className="brand-mark"><Languages size={22}/></span><span>Lingo<span className="brand-accent">Pro</span><small>LANGUAGE STUDIO</small></span></Link>
      <div className="side-label">WORKSPACE</div>
      <nav>{nav.map(n=><NavLink key={n.to} to={n.to} end={n.to==='/'} onClick={()=>setMobileOpen(false)} className={({isActive})=>`nav-link ${isActive?'active':''}`}><n.icon size={18}/>{n.label}{n.to==='/dashboard'&&<span className="nav-dot"/>}</NavLink>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-card"><div className="mini-spark">✦</div><strong>Your next chapter</strong><p>Small steps today. Big fluency tomorrow.</p><Link to="/courses">Find a course <ArrowRight size={14}/></Link></div>
      <div className="sidebar-bottom"><div className="avatar">{auth.user?.name?.[0]?.toUpperCase()||'G'}</div><div className="user-meta"><strong>{auth.user?.name||'Guest learner'}</strong><span>{auth.user?.role==='admin'?'Administrator':auth.user?'Free learner':'Explore LingoPro'}</span></div>{auth.token&&<button className="icon-btn" title="Log out" onClick={()=>{auth.logout();navigate('/');notify('Logged out.')}}><LogOut size={17}/></button>}</div>
    </aside>
    {mobileOpen&&<button className="mobile-overlay" onClick={()=>setMobileOpen(false)} aria-label="Close menu"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileOpen(!mobileOpen)} aria-label="Toggle menu">{mobileOpen?<X/>:<Menu/>}</button><div className="breadcrumb">Workspace <span>/</span> <strong>{location.pathname==='/admin'?'Admin studio':location.pathname==='/dashboard'?'My learning':location.pathname==='/courses'?'Explore courses':'Overview'}</strong></div><div className="top-actions"><div className="search-box"><Search size={16}/><input placeholder="Search languages..." value={search} onChange={e=>{setSearch(e.target.value);if(location.pathname!='/courses')navigate('/courses');}}/></div><button className="icon-btn notification" title="Notifications"><Bell size={18}/><i/></button>{auth.user?<div className="top-avatar">{auth.user.name[0].toUpperCase()}</div>:<Link className="btn btn-dark btn-sm" to="/login">Sign in <ArrowRight size={14}/></Link>}</div></header>
      {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
      <Routes>
        <Route path="/" element={<Home courses={courses} auth={auth} enroll={enroll} money={money}/>}/>
        <Route path="/courses" element={<Courses courses={courses.filter(c=>(c.title+' '+c.language+' '+c.level).toLowerCase().includes(search.toLowerCase()))} enroll={enroll} money={money} auth={auth}/>}/>
        <Route path="/login" element={<AuthPage mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} submit={submitAuth} busy={busy}/>}/>
        <Route path="/dashboard" element={auth.token?<Dashboard data={dashboard} courses={courses} request={request} refresh={refresh} money={money} notify={notify}/>:<AuthPage mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} submit={submitAuth} busy={busy}/>}/>
        <Route path="/admin" element={auth.user?.role==='admin'?<Admin overview={adminOverview} students={students} courses={courses} form={adminForm} setForm={setAdminForm} submit={createCourse} money={money}/>:<AuthPage mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} submit={submitAuth} busy={busy}/>}/>
        <Route path="*" element={<Home courses={courses} auth={auth} enroll={enroll} money={money}/>}/>
      </Routes>
      <footer className="footer"><span>© 2026 LingoPro Learning, Inc.</span><span>Made for curious minds <span className="heart">♥</span></span></footer>
    </main>
  </div>;
}
function PageHeading({eyebrow,title,description,action}) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function Home({courses,auth,enroll,money}) {
 return <div className="page-content">
  <section className="hero"><div className="hero-copy"><div className="pill"><span className="pill-dot"/> YOUR LANGUAGE JOURNEY STARTS HERE</div><h1>Say hello to a<br/><span>whole new world.</span></h1><p>Build real-world language skills, one small win at a time. Learn at your pace, practise with purpose, and celebrate every milestone.</p><div className="hero-actions"><Link className="btn btn-primary" to="/courses">Explore courses <ArrowRight size={16}/></Link><Link className="btn btn-light" to={auth.token?'/dashboard':'/login'}><Play size={15}/> {auth.token?'Continue learning':'Get started free'}</Link></div><div className="hero-social"><div className="avatar-stack"><span>A</span><span>M</span><span>J</span><span>+</span></div><div><strong>Every day is a fresh start</strong><small>15 minutes can change your fluency.</small></div></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="language-orb"><span className="orb-main">你好</span><span className="orb-sub">HELLO</span><span className="orb-es">¡Hola!</span><span className="orb-fr">Bonjour</span><span className="orb-ja">こんにちは</span></div><div className="float-card float-streak"><span className="float-icon flame"><Flame size={18}/></span><span><strong>7 day streak</strong><small>You're on fire!</small></span></div><div className="float-card float-progress"><span className="progress-ring">82%</span><span><strong>Looking good</strong><small>Weekly progress</small></span></div><div className="float-card float-word"><span className="word-icon">Aa</span><span><strong>Word of the day</strong><small>Serendipity · noun</small></span></div></div><div className="hero-bottom-note"><span>✳</span> LEARN A LITTLE. GROW A LOT.</div></section>
  <section className="trust-row"><div><strong>Learn by doing</strong><span>Interactive lessons, not endless lectures</span></div><div><strong>Track your growth</strong><span>Progress that keeps you motivated</span></div><div><strong>Built around you</strong><span>Learn whenever life lets you</span></div></section>
  <section className="section-block"><div className="section-head"><div><div className="eyebrow">PICK UP SOMETHING NEW</div><h2>Find your next favourite <span>language.</span></h2><p>Thoughtfully structured courses to help you get moving.</p></div><Link className="text-link" to="/courses">Browse all courses <ArrowRight size={16}/></Link></div><div className="course-grid">{courses.slice(0,3).map((c,i)=><CourseCard key={c.id} course={c} index={i} enroll={enroll} money={money}/>)}</div></section>
  <section className="quote-band"><span className="quote-mark">“</span><div><h2>Fluency isn't a destination.<br/><span>It's a thousand little moments.</span></h2><p>Show up for one of them today.</p></div><Link className="btn btn-dark" to="/courses">Start your journey <ArrowRight size={15}/></Link></section>
 </div>;
}
const palettes=[['#e5edff','#304f9d','EN'],['#fbe9d7','#9b5726','ES'],['#e8e5fa','#6356a7','FR'],['#def2e9','#267c60','JP']];
function CourseCard({course,index=0,enroll,money}) {
 const p=palettes[index%palettes.length];
 return <article className="course-card"><div className="course-art" style={{background:p[0]}}><span className="course-language" style={{color:p[1]}}>{course.language||p[2]}</span><span className="course-letter" style={{color:p[1]}}>{(course.language||'L').slice(0,2).toUpperCase()}</span><span className="course-level">{course.level||'Beginner'}</span></div><div className="course-body"><div className="course-meta"><span><BookOpen size={14}/>{course.lesson_count??'—'} lessons</span><span><Clock3 size={14}/>Self-paced</span></div><h3>{course.title}</h3><p>{course.description}</p><div className="course-footer"><strong>{money(course.price_paise)}</strong><button className="btn btn-outline btn-sm" onClick={()=>enroll(course.id)}>View course <ArrowRight size={14}/></button></div></div></article>;
}
function Courses({courses,enroll,money,auth}) {
 return <div className="page-content inner-page"><PageHeading eyebrow="THE COURSE LIBRARY" title={<>A little curiosity goes <span> a long way.</span></>} description="Pick a language, find your rhythm, and start making progress." action={<div className="course-count"><strong>{courses.length.toString().padStart(2,'0')}</strong><span>COURSES</span></div>}/><div className="filter-row"><span className="filter-active">All languages</span><span>Beginner friendly</span><span>Self-paced</span><span className="filter-note"><Target size={15}/> Find your pace, not perfection.</span></div>{courses.length?<div className="course-grid">{courses.map((c,i)=><CourseCard key={c.id} course={c} index={i} enroll={enroll} money={money}/>)}</div>:<div className="empty-state"><Compass size={30}/><h3>No courses found</h3><p>Try another search or clear your search term.</p></div>}</div>;
}
function AuthPage({mode,setMode,form,setForm,submit,busy}) {
 return <div className="auth-layout"><div className="auth-art"><div className="auth-art-inner"><span className="auth-star">✳</span><div className="eyebrow">A WORLD OF WORDS AWAITS</div><h2>Every language<br/>opens a <span>new door.</span></h2><p>Make space for a new skill, a new connection, and a new way to see the world.</p><div className="auth-language-cloud"><span>Hola!</span><span>Bonjour</span><span>你好</span><span>Hallo</span><span>ありがとう</span></div></div></div><div className="auth-form-wrap"><div className="auth-form"><div className="eyebrow">{mode==='login'?'WELCOME BACK':'YOUR STORY STARTS HERE'}</div><h1>{mode==='login'?'Good to see you.':'Let’s get you started.'}</h1><p>{mode==='login'?'Pick up right where you left off.':'Create an account and start your language journey.'}</p><form onSubmit={submit}>{mode==='signup'&&<label>Full name<input required minLength="2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name"/></label>}<label>Email address<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label><button className="btn btn-primary auth-submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in to LingoPro':'Create my account'} <ArrowRight size={16}/></button></form><div className="auth-switch">{mode==='login'?"New around here?":"Already have an account?"} <button onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create an account':'Sign in'}</button></div><div className="demo-note"><LockKeyhole size={15}/><span>Local demo: <b>student@lingopro.local</b> / <b>Student123!</b></span></div></div></div></div>;
}
function Dashboard({data,courses,request,refresh,money,notify}) {
 const [lessons,setLessons]=useState([]);
 const [activeCourse,setActiveCourse]=useState(null);
 const [loading,setLoading]=useState(false);
 const openCourse=async c=>{setActiveCourse(c);setLoading(true);try{setLessons((await request(`/courses/${c.id}/lessons`)).lessons)}catch(e){notify(e.message)}finally{setLoading(false)}};
 const complete=async id=>{try{await request(`/lessons/${id}/complete`,{method:'POST'});notify('Lesson completed — nice work!');if(activeCourse) await openCourse(activeCourse);refresh()}catch(e){notify(e.message)}};
 return <div className="page-content inner-page"><PageHeading eyebrow="YOUR LEARNING SPACE" title={<>Welcome back<span>, learner.</span></>} description="A little progress each day adds up to something wonderful." action={<div className="date-chip"><span className="date-dot"/> YOUR JOURNEY, YOUR PACE</div>}/><div className="stats-grid"><Stat icon={BookOpen} label="Enrolled courses" value={data?.stats?.enrolled??0} note="Your learning library"/><Stat icon={CheckCircle2} label="Lessons completed" value={data?.stats?.completedLessons??0} note="Every step counts"/><Stat icon={Target} label="Quiz attempts" value={data?.stats?.quizAttempts??0} note="Practice makes progress"/><Stat icon={Trophy} label="Best quiz score" value={`${data?.stats?.bestScore??0}%`} note="Keep reaching higher"/></div><div className="dashboard-columns"><section className="panel learning-panel"><div className="panel-head"><div><div className="eyebrow">KEEP THE MOMENTUM</div><h2>Pick up where you left off</h2></div><Link className="text-link" to="/courses">Find more <ArrowRight size={14}/></Link></div>{data?.courses?.length?data.courses.map(c=><div className="learning-course" key={c.id}><div className="learning-icon"><BookOpen/></div><div className="learning-course-info"><h3>{c.title}</h3><p>{c.language} · {c.level}</p><div className="progress-track"><span style={{width:`${c.progress}%`}}/></div><small>{c.completed_lessons} of {c.total_lessons} lessons · {c.progress}% complete</small></div><button className="btn btn-outline btn-sm" onClick={()=>openCourse(c)}>Continue <ArrowRight size={14}/></button></div>):<div className="empty-state compact"><BookOpen size={28}/><h3>Your next chapter is waiting</h3><p>Enrol in a course to start building your skills.</p><Link className="btn btn-primary btn-sm" to="/courses">Explore courses</Link></div>}</section><aside className="panel weekly-panel"><div className="eyebrow">YOUR MOMENTUM</div><h2>Consistency beats intensity.</h2><p>Come back for a little practice each day. Your future fluent self will thank you.</p><div className="week-bars">{['M','T','W','T','F','S','S'].map((d,i)=><div key={i} className="week-day"><div className={`week-bar ${i<3?'filled':''}`} style={{height:`${i<3?40+i*14:18}px`}}>{i<3?'✓':''}</div><small>{d}</small></div>)}</div><div className="weekly-foot"><span><Flame size={17}/> Build a streak</span><span>One day at a time</span></div></aside></div>{activeCourse&&<section className="panel lesson-panel"><div className="panel-head"><div><div className="eyebrow">COURSE CONTENT</div><h2>{activeCourse.title}</h2></div><button className="btn btn-outline btn-sm" onClick={()=>setActiveCourse(null)}>Close</button></div>{loading?<p>Loading lessons…</p>:lessons.map(l=><div className="lesson-row" key={l.id}><span className={l.completed?'lesson-check done':'lesson-check'}>{l.completed?<CheckCircle2 size={18}/>:<Play size={15}/>}</span><div><strong>{l.lesson_order}. {l.title}</strong><p>{l.content}</p></div>{l.completed?<span className="completed-label">Completed</span>:<button className="btn btn-primary btn-sm" onClick={()=>complete(l.id)}>Mark complete</button>}</div>)}</section>}</div>;
}
function Stat({icon:Icon,label,value,note}) {return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{note}</small></div>}
function Admin({overview,students,courses,form,setForm,submit,money}) {
 return <div className="page-content inner-page"><PageHeading eyebrow="LINGOPRO CONTROL ROOM" title={<>Make learning <span>happen.</span></>} description="Manage your course catalogue and keep an eye on your learning community." action={<span className="admin-badge"><Settings size={14}/> ADMIN ACCESS</span>}/><div className="stats-grid"><Stat icon={Users} label="Students" value={overview?.students??0} note="Registered learners"/><Stat icon={GraduationCap} label="Courses" value={overview?.courses??0} note="Across the catalogue"/><Stat icon={BookOpen} label="Enrollments" value={overview?.enrollments??0} note="Active course access"/><Stat icon={Trophy} label="Paid orders" value={overview?.paidPayments??0} note="Verified payments"/></div><div className="admin-grid"><section className="panel"><div className="panel-head"><div><div className="eyebrow">COURSE CATALOGUE</div><h2>Create a course</h2></div><Plus size={20}/></div><form className="admin-form" onSubmit={submit}><label>Course title<input required minLength="3" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Confident English Speaking"/></label><div className="form-row"><label>Language<input required value={form.language} onChange={e=>setForm({...form,language:e.target.value})}/></label><label>Level<select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></div><div className="form-row"><label>Price (INR)<input type="number" min="0" max="100000" required value={form.priceRupees} onChange={e=>setForm({...form,priceRupees:e.target.value})}/></label><label className="publish-toggle"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/> Publish immediately</label></div><label>Description<textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What will students learn?"/></label><button className="btn btn-primary">Create course <ArrowRight size={15}/></button></form></section><section className="panel"><div className="panel-head"><div><div className="eyebrow">LEARNING COMMUNITY</div><h2>Recent students</h2></div><Users size={20}/></div>{students.length?students.slice(0,7).map(s=><div className="student-row" key={s.id}><span className="student-avatar">{s.name[0]}</span><span className="student-info"><strong>{s.name}</strong><small>{s.email}</small></span><span className="student-enroll">{s.enrollments} courses</span></div>):<div className="empty-state compact"><Users size={24}/><p>Student information will appear here.</p></div>}</section></div><section className="panel admin-courses"><div className="panel-head"><div><div className="eyebrow">ALL COURSES</div><h2>Course inventory</h2></div><span className="course-count"><strong>{courses.length}</strong><span>LIVE</span></span></div><div className="table-wrap"><table><thead><tr><th>COURSE</th><th>LANGUAGE</th><th>LEVEL</th><th>PRICE</th></tr></thead><tbody>{courses.map(c=><tr key={c.id}><td><strong>{c.title}</strong></td><td>{c.language}</td><td>{c.level}</td><td>{money(c.price_paise)}</td></tr>)}</tbody></table></div></section></div>;
}
export default App;
