import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  Search, 
  LayoutGrid, 
  Users, 
  Settings, 
  FileText,
  Trash2,
  RefreshCw,
  UploadCloud,
  LogOut,
  Camera,
  Type,
  Save,
  CheckCircle,
  AlertCircle,
  Edit2,
  X,
  LogIn,
  ArrowRight,
  Filter
} from 'lucide-react';
import { Candidate, AppConfig, CandidateStatus } from './types';
import * as fileSystem from './services/fileSystem';
import { parseResumeWithGemini, parseTextWithGemini } from './services/geminiService';

// --- Sub-Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => (
  <div className="w-64 h-full bg-white flex flex-col border-r border-gray-100 flex-shrink-0 z-10">
    <div className="p-8 flex items-center gap-3">
      {/* Changed to Image Logo */}
      <img 
        src="/logo.png" 
        alt="TalentOS Logo" 
        className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-blue-200" 
        onError={(e) => {
          // Fallback if image not found
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextElementSibling?.classList.remove('hidden');
        }}
      />
      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200 hidden">
        T
      </div>
      <div>
        <h1 className="font-bold text-gray-900 leading-tight">TalentOS</h1>
        <p className="text-xs text-gray-500 font-medium">智能人才库</p>
      </div>
    </div>

    <nav className="flex-1 px-4 space-y-2">
      {[
        { id: 'entry', icon: FileText, label: '信息录入' },
        { id: 'management', icon: Users, label: '人才管理' },
        { id: 'settings', icon: Settings, label: '系统设置' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
            activeTab === item.id 
              ? 'bg-blue-50 text-blue-600 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <item.icon size={20} />
          {item.label}
        </button>
      ))}
    </nav>

    <div className="p-6 border-t border-gray-100">
      <div className="flex items-center gap-3">
        <img 
            src="/avatar.png" 
            alt="User Avatar" 
            className="w-10 h-10 rounded-full object-cover border border-gray-200"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
        />
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold hidden">
           陈
        </div>
        <div className="overflow-hidden">
           <p className="text-sm font-bold text-gray-900 truncate">陈哈哈</p>
           <p className="text-xs text-gray-500">已登录</p>
        </div>
      </div>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: CandidateStatus }) => {
  const styles = {
    [CandidateStatus.NEW]: "bg-green-100 text-green-700",
    [CandidateStatus.SCREENING]: "bg-blue-100 text-blue-700",
    [CandidateStatus.INTERVIEWING]: "bg-purple-100 text-purple-700",
    [CandidateStatus.OFFER_SENT]: "bg-orange-100 text-orange-700",
    [CandidateStatus.HIRED]: "bg-emerald-600 text-white",
    [CandidateStatus.REJECTED]: "bg-red-100 text-red-700",
    [CandidateStatus.OPEN_TO_WORK]: "bg-teal-50 text-teal-600 border border-teal-100"
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${styles[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};

// --- Main Application ---

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({ username: '陈哈哈', apiKey: '', isConfigured: false });
  const [activeTab, setActiveTab] = useState('entry');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [reconnectNeeded, setReconnectNeeded] = useState(false);

  // Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Candidate | null>(null);
  
  // Filter State
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({
      gender: '',
      education: '',
      intent: '', // Replaced isEmployed with intent
      location: '',
      ageMin: '',
      ageMax: '',
      expMin: '',
      expMax: ''
  });

  // Entry State
  const [entryMode, setEntryMode] = useState<'text' | 'file'>('file');
  const [stagingData, setStagingData] = useState<Partial<Candidate> | null>(null);
  const [stagingFile, setStagingFile] = useState<File | null>(null);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize
  useEffect(() => {
    // Only check for API key and access
    const savedKey = localStorage.getItem('talentos_api_key');
    const hadAccess = localStorage.getItem('talentos_access_granted') === 'true';

    if (savedKey && hadAccess) {
      setConfig({ username: '陈哈哈', apiKey: savedKey, isConfigured: true });
      setReconnectNeeded(true);
    }
  }, []);

  const handleLogin = async (apiKey: string) => {
    const success = await fileSystem.requestDirectoryAccess();
    if (success) {
      localStorage.setItem('talentos_username', '陈哈哈');
      localStorage.setItem('talentos_api_key', apiKey);
      localStorage.setItem('talentos_access_granted', 'true');
      setConfig({ username: '陈哈哈', apiKey, isConfigured: true });
      setReconnectNeeded(false);
      loadData();
    }
  };

  const handleReconnect = async () => {
    const success = await fileSystem.requestDirectoryAccess();
    if (success) {
      setReconnectNeeded(false);
      loadData();
    }
  };

  const loadData = async () => {
    try {
      const data = await fileSystem.readDatabase();
      setCandidates(data);
    } catch (e) {
      console.error("Failed to load DB", e);
    }
  };

  // --- Parsing Logic ---

  const handleParse = async () => {
    setIsProcessing(true);
    setStagingData(null);
    try {
      let result: Partial<Candidate> = {};

      if (entryMode === 'text') {
        if (!inputText.trim()) return;
        result = await parseTextWithGemini(inputText, config.apiKey);
        setStagingFile(null); // No file to save
      } else {
        if (!stagingFile) return;
        result = await parseResumeWithGemini(stagingFile, config.apiKey);
      }

      setStagingData(result);
    } catch (e) {
      alert(`解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setStagingFile(file);
    setTimeout(() => {
        handleParseFile(file);
    }, 100);
  };

  const handleParseFile = async (file: File) => {
    setIsProcessing(true);
    setStagingData(null);
    try {
        const result = await parseResumeWithGemini(file, config.apiKey);
        setStagingData(result);
    } catch(e) {
        alert(`解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
        setStagingFile(null);
    } finally {
        setIsProcessing(false);
    }
  }

  // --- Save Logic ---

  const handleSaveToDB = async () => {
    if (!stagingData) return;

    try {
      let savedFileName = '';

      // 1. Save File if exists
      if (stagingFile) {
        savedFileName = await fileSystem.saveResumeFile(stagingFile, stagingData.name || 'Unknown');
      }

      // 2. Create Record
      const timestamp = new Date().toLocaleString('zh-CN');
      const newRecord: Candidate = {
        id: crypto.randomUUID(),
        name: stagingData.name || '未知姓名',
        gender: stagingData.gender || '未知',
        age: stagingData.age || '未知',
        education: stagingData.education || '未知',
        yearsOfExperience: stagingData.yearsOfExperience || '0个月',
        positionExperience: stagingData.positionExperience || '',
        currentCompany: stagingData.currentCompany || '',
        location: stagingData.location || '',
        factoryExperience: stagingData.factoryExperience || '',
        contact: stagingData.contact || '',
        
        // New Fields Default
        recentRole: stagingData.recentRole || '候选人',
        intent: stagingData.intent || '未知',
        isEmployed: stagingData.isEmployed || '未知',
        source: stagingData.source || '',
        notes: stagingData.notes || '',
        aiPersona: stagingData.aiPersona || '',
        aiTags: stagingData.aiTags || [],

        status: CandidateStatus.NEW,
        dateAdded: timestamp,
        lastModified: timestamp,
        fileName: savedFileName,
        tags: [entryMode === 'text' ? 'Text Entry' : 'File Import']
      };

      const newList = [...candidates, newRecord];
      setCandidates(newList);
      await fileSystem.writeDatabase(newList);
      
      // Reset
      setStagingData(null);
      setStagingFile(null);
      setInputText('');
      alert('入库成功！');
      setActiveTab('management'); // Switch to list view

    } catch (e) {
      alert('保存失败，请检查文件夹权限');
    }
  };

  // --- Management Logic ---

  const startEdit = (candidate: Candidate) => {
    setEditingId(candidate.id);
    setEditForm({...candidate});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    
    // Update timestamp
    const updatedCandidate = {
        ...editForm,
        lastModified: new Date().toLocaleString('zh-CN')
    };

    const newList = candidates.map(c => c.id === updatedCandidate.id ? updatedCandidate : c);
    setCandidates(newList);
    await fileSystem.writeDatabase(newList);
    setEditingId(null);
    setEditForm(null);
  };

  const clearFilters = () => {
      setFilterCriteria({
          gender: '',
          education: '',
          intent: '', // Reset intent
          location: '',
          ageMin: '',
          ageMax: '',
          expMin: '',
          expMax: ''
      });
  };

  // --- Views ---

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200 rounded-full blur-[100px] opacity-30"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200 rounded-full blur-[100px] opacity-30"></div>

        <div className="bg-white p-8 rounded-2xl shadow-xl w-[480px] z-10 border border-white/50">
          <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <RefreshCw className="text-blue-600 animate-spin-slow" size={32} />
             </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {reconnectNeeded ? "欢迎回来，陈哈哈" : "TalentOS 智能招聘"}
          </h2>
          <p className="text-center text-gray-500 mb-6 px-4 text-sm leading-relaxed">
            {reconnectNeeded 
                ? "由于浏览器安全策略，刷新后需重新授权文件夹访问。" 
                : "本应用为离线模式。请配置 API Key，然后点击下方登录按钮选择本地文件夹启动。"}
          </p>

          {!reconnectNeeded ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              handleLogin(form.apiKey.value);
            }} className="space-y-6">
               <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                   <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">API KEY (Gemini)</label>
                    <input name="apiKey" type="password" placeholder="请输入您的 Key" className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-sm" required />
                  </div>
                  {/* Removed Username Input */}
               </div>

               <div className="pt-2 border-t border-gray-100">
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 group">
                    <span>登录并启动</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <p className="text-xs text-center text-gray-400 mt-3">点击登录后请选择 Google Drive 同步目录或本地文件夹</p>
               </div>
            </form>
          ) : (
            <div className="space-y-4">
               <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                 <img 
                    src="/avatar.png" 
                    alt="User Avatar" 
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                />
                 <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold hidden">
                    陈
                 </div>
                 <div>
                    <p className="font-bold text-gray-900">陈哈哈</p>
                    <p className="text-xs text-gray-500">会话已过期</p>
                 </div>
              </div>
              <button onClick={handleReconnect} className="w-full bg-black hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg">
                <FolderOpen size={20} /> 重新授权文件夹
              </button>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full text-red-500 text-sm font-medium py-2 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2">
                <LogOut size={16} /> 退出登录
              </button>
            </div>
          )}
        </div>
      </div>
  );

  const renderEntry = () => (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
        <h2 className="text-2xl font-bold text-gray-800">信息录入</h2>
        
        {/* Input Mode Tabs */}
        <div className="flex gap-4 mb-6">
            <button onClick={() => setEntryMode('text')} className={`flex-1 py-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${entryMode === 'text' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <Type size={24} />
                <span className="font-semibold">文字录入</span>
            </button>
            <button onClick={() => setEntryMode('file')} className={`flex-1 py-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${entryMode === 'file' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <UploadCloud size={24} />
                <span className="font-semibold">文件上传 (PDF/Word)</span>
            </button>
        </div>

        {/* Input Area */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[200px] flex flex-col justify-center">
            {entryMode === 'text' && (
                <div className="space-y-4">
                    <textarea 
                        className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                        placeholder="在此粘贴简历文本或输入候选人信息..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                    <button 
                        onClick={handleParse} 
                        disabled={isProcessing || !inputText}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                        开始AI解析
                    </button>
                </div>
            )}

            {(entryMode === 'file') && (
                <div className="text-center space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:bg-gray-50 transition-colors relative">
                        <input 
                            type="file" 
                            accept=".pdf,.doc,.docx,.txt"
                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="pointer-events-none">
                             {isProcessing ? (
                                 <div className="flex flex-col items-center gap-3 text-blue-600">
                                     <RefreshCw className="animate-spin w-10 h-10" />
                                     <p>正在分析文件内容...</p>
                                 </div>
                             ) : (
                                 <div className="flex flex-col items-center gap-2 text-gray-500">
                                    <FileText className="w-12 h-12 mb-2" />
                                    <p className="font-medium text-lg text-gray-700">点击选择或拖入文件</p>
                                    <p className="text-sm opacity-70">支持 PDF, Word</p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Result Form */}
        {stagingData && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <CheckCircle className="text-green-500" size={20} /> 解析结果确认
                    </h3>
                    <span className="text-sm text-gray-500">请核对并完善信息后入库</span>
                </div>

                <div className="grid grid-cols-4 gap-6">
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">姓名</label>
                        <input value={stagingData.name || ''} onChange={e => setStagingData({...stagingData, name: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">最近职位</label>
                        <input value={stagingData.recentRole || ''} onChange={e => setStagingData({...stagingData, recentRole: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">年龄</label>
                        <input value={stagingData.age || ''} onChange={e => setStagingData({...stagingData, age: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">性别</label>
                        <input value={stagingData.gender || ''} onChange={e => setStagingData({...stagingData, gender: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">学历</label>
                        <input value={stagingData.education || ''} onChange={e => setStagingData({...stagingData, education: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">工作年限 (计算值)</label>
                        <input value={stagingData.yearsOfExperience || ''} onChange={e => setStagingData({...stagingData, yearsOfExperience: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="X年X个月" />
                    </div>
                     <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">最近公司</label>
                        <input value={stagingData.currentCompany || ''} onChange={e => setStagingData({...stagingData, currentCompany: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>

                    <div className="col-span-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">岗位经验 (历史职位与时间)</label>
                        <textarea value={stagingData.positionExperience || ''} onChange={e => setStagingData({...stagingData, positionExperience: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="例如：软件工程师 (2020-2022); 高级工程师 (2022-至今)" />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">意向</label>
                        <select 
                            value={stagingData.intent || '未知'} 
                            onChange={e => {
                                const val = e.target.value;
                                let empStatus = stagingData.isEmployed || '未知';
                                
                                if (val.includes('在职')) empStatus = '在职';
                                else if (val.includes('离职')) empStatus = '离职';
                                else if (val === '未知') empStatus = '未知';

                                setStagingData({...stagingData, intent: val, isEmployed: empStatus});
                            }} 
                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="未知">未知</option>
                            <option value="在职，稳定">在职，稳定</option>
                            <option value="在职，看机会">在职，看机会</option>
                            <option value="离职，不考虑">离职，不考虑</option>
                            <option value="离职，看机会">离职，看机会</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">是否在职 (自动推导)</label>
                        <select value={stagingData.isEmployed || '未知'} onChange={e => setStagingData({...stagingData, isEmployed: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="未知">未知</option>
                            <option value="在职">在职</option>
                            <option value="离职">离职</option>
                        </select>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">所在地区</label>
                        <input value={stagingData.location || ''} onChange={e => setStagingData({...stagingData, location: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">联系方式</label>
                        <input value={stagingData.contact || ''} onChange={e => setStagingData({...stagingData, contact: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>

                    {/* Adjusted Fields Row */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">工厂经验/特殊技能</label>
                        <input value={stagingData.factoryExperience || ''} onChange={e => setStagingData({...stagingData, factoryExperience: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="简短描述..." />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">人才来源</label>
                        <input value={stagingData.source || ''} onChange={e => setStagingData({...stagingData, source: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例如：Boss直聘、内推" />
                    </div>

                    <div className="col-span-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">备注</label>
                        <textarea value={stagingData.notes || ''} onChange={e => setStagingData({...stagingData, notes: e.target.value})} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="电话沟通记录..." />
                    </div>

                    {/* AI Persona Section */}
                    <div className="col-span-4 mt-2">
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <label className="block text-xs font-bold text-purple-600 uppercase mb-2 flex items-center gap-2">
                                <Users size={14} /> AI 候选人画像
                            </label>
                            <textarea 
                                value={stagingData.aiPersona || ''} 
                                onChange={e => setStagingData({...stagingData, aiPersona: e.target.value})} 
                                className="w-full p-3 bg-white border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none h-24 text-sm leading-relaxed" 
                                placeholder="AI 生成的候选人综合评价 (100字以内)..."
                                maxLength={120}
                            />
                            <div className="mt-3 flex gap-2 flex-wrap">
                                {(stagingData.aiTags || []).map((tag, idx) => (
                                    <span key={idx} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs border border-purple-200">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex gap-4">
                    <button onClick={handleSaveToDB} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 flex items-center justify-center gap-2">
                        <Save size={20} /> 确认入库
                    </button>
                    <button onClick={() => {setStagingData(null); setStagingFile(null);}} className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
                        取消
                    </button>
                </div>
            </div>
        )}
    </div>
  );

  const renderManagement = () => {
    // Helper to extract numbers from "28岁" or "5年3个月"
    const getAgeVal = (str: string) => {
        const match = str.match(/(\d+)/);
        return match ? parseInt(match[1] || match[0], 10) : -1;
    };
    const getExpVal = (str: string) => {
        // Extract year part only from "X年..."
        const match = str.match(/(\d+)年/);
        return match ? parseInt(match[1], 10) : 0;
    };

    const filtered = candidates.filter(c => {
        // Text Search
        const matchesSearch = 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.recentRole.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.aiPersona?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.aiTags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Range Filters
        const cAge = getAgeVal(c.age);
        const cExp = getExpVal(c.yearsOfExperience);

        const fAgeMin = filterCriteria.ageMin ? parseInt(filterCriteria.ageMin) : null;
        const fAgeMax = filterCriteria.ageMax ? parseInt(filterCriteria.ageMax) : null;
        const fExpMin = filterCriteria.expMin ? parseInt(filterCriteria.expMin) : null;
        const fExpMax = filterCriteria.expMax ? parseInt(filterCriteria.expMax) : null;

        const matchesAge = (fAgeMin === null || cAge >= fAgeMin) && (fAgeMax === null || cAge <= fAgeMax);
        const matchesExp = (fExpMin === null || cExp >= fExpMin) && (fExpMax === null || cExp <= fExpMax);

        const matchesFilter = 
            matchesAge &&
            matchesExp &&
            (!filterCriteria.gender || c.gender === filterCriteria.gender) &&
            (!filterCriteria.education || c.education.includes(filterCriteria.education)) &&
            (!filterCriteria.intent || c.intent.includes(filterCriteria.intent)) &&
            (!filterCriteria.location || c.location.includes(filterCriteria.location));

        return matchesSearch && matchesFilter;
    });

    const activeFilterCount = Object.values(filterCriteria).filter(Boolean).length;

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 relative">
                <h2 className="text-2xl font-bold text-gray-800">人才管理</h2>
                <div className="flex gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="搜索姓名、画像、标签..." 
                            className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
                        />
                    </div>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                                showFilterPanel || activeFilterCount > 0
                                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <Filter size={18} />
                            <span>筛选</span>
                            {activeFilterCount > 0 && (
                                <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Dropdown Panel */}
                        {showFilterPanel && (
                            <div className="absolute right-0 top-12 w-[600px] bg-white border border-gray-100 shadow-2xl rounded-2xl p-6 z-50 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800">高级筛选</h3>
                                    <button onClick={clearFilters} className="text-xs text-red-500 hover:underline">清空条件</button>
                                </div>
                                <div className="grid grid-cols-3 gap-6">
                                    {/* Age Range */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-2">年龄 (岁)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                placeholder="Min" 
                                                value={filterCriteria.ageMin} 
                                                onChange={e => setFilterCriteria({...filterCriteria, ageMin: e.target.value})}
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <span className="text-gray-400">-</span>
                                            <input 
                                                type="number" 
                                                placeholder="Max" 
                                                value={filterCriteria.ageMax} 
                                                onChange={e => setFilterCriteria({...filterCriteria, ageMax: e.target.value})}
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    {/* Experience Range */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-2">工作年限 (年)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                placeholder="Min" 
                                                value={filterCriteria.expMin} 
                                                onChange={e => setFilterCriteria({...filterCriteria, expMin: e.target.value})}
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <span className="text-gray-400">-</span>
                                            <input 
                                                type="number" 
                                                placeholder="Max" 
                                                value={filterCriteria.expMax} 
                                                onChange={e => setFilterCriteria({...filterCriteria, expMax: e.target.value})}
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    {/* Gender */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-2">性别</label>
                                        <select 
                                            value={filterCriteria.gender} 
                                            onChange={e => setFilterCriteria({...filterCriteria, gender: e.target.value})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                        >
                                            <option value="">全部</option>
                                            <option value="男">男</option>
                                            <option value="女">女</option>
                                        </select>
                                    </div>
                                     <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">学历 (包含)</label>
                                        <input 
                                            placeholder="例如：本科"
                                            value={filterCriteria.education} 
                                            onChange={e => setFilterCriteria({...filterCriteria, education: e.target.value})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    {/* Intent - Replaced IsEmployed */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">意向</label>
                                        <select 
                                            value={filterCriteria.intent} 
                                            onChange={e => setFilterCriteria({...filterCriteria, intent: e.target.value})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                                        >
                                            <option value="">全部</option>
                                            <option value="在职，稳定">在职，稳定</option>
                                            <option value="在职，看机会">在职，看机会</option>
                                            <option value="离职，不考虑">离职，不考虑</option>
                                            <option value="离职，看机会">离职，看机会</option>
                                            <option value="未知">未知</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">所在地区 (包含)</label>
                                        <input 
                                            placeholder="例如：深圳"
                                            value={filterCriteria.location} 
                                            onChange={e => setFilterCriteria({...filterCriteria, location: e.target.value})}
                                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
                                     <button onClick={() => setShowFilterPanel(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">完成</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col relative">
                <div className="overflow-auto flex-1 pb-4">
                    <table className="w-max text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="py-4 px-4 whitespace-nowrap sticky left-0 bg-gray-50 border-r border-gray-100 shadow-sm w-48">基本信息</th>
                                <th className="py-4 px-4 whitespace-nowrap w-32">最近职位</th>
                                <th className="py-4 px-4 whitespace-nowrap w-24">经验</th>
                                <th className="py-4 px-4 whitespace-nowrap w-64">岗位经验</th>
                                <th className="py-4 px-4 whitespace-nowrap w-56">公司</th>
                                <th className="py-4 px-4 whitespace-nowrap w-40">意向/状态</th>
                                <th className="py-4 px-4 whitespace-nowrap w-24">地区</th>
                                <th className="py-4 px-4 whitespace-nowrap w-32">联系</th>
                                <th className="py-4 px-4 whitespace-nowrap w-48">AI 画像</th>
                                <th className="py-4 px-4 whitespace-nowrap w-64">备注/来源</th>
                                <th className="py-4 px-4 whitespace-nowrap w-32">更新时间</th>
                                <th className="py-4 px-4 whitespace-nowrap sticky right-0 bg-gray-50 border-l border-gray-100 shadow-sm text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="py-12 text-center text-gray-400">暂无数据</td>
                                </tr>
                            ) : (
                                filtered.map(c => {
                                    const isEditing = editingId === c.id;
                                    const data = isEditing && editForm ? editForm : c;

                                    return (
                                    <tr key={c.id} className="hover:bg-blue-50/50 transition-colors group h-auto py-6">
                                        <td className="py-4 px-4 sticky left-0 bg-white group-hover:bg-blue-50/50 border-r border-gray-100 align-top">
                                            <div className="font-bold text-gray-900 mb-1 text-base">{data.name}</div>
                                            <div className="text-xs text-gray-500 mb-2">{data.gender} | {data.age} | {data.education}</div>
                                            <div className="flex flex-wrap gap-1">
                                                {(data.aiTags || []).slice(0, 3).map((t, i) => (
                                                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded border border-purple-200 whitespace-nowrap">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        
                                        <td className="py-4 px-4 align-top">
                                            {isEditing ? <input className="w-full p-2 border rounded" value={data.recentRole} onChange={e => setEditForm({...editForm!, recentRole: e.target.value})} /> : <span className="text-blue-600 font-medium">{data.recentRole}</span>}
                                        </td>
                                        
                                        <td className="py-4 px-4 align-top">
                                            {isEditing ? <input className="w-full p-2 border rounded" value={data.yearsOfExperience} onChange={e => setEditForm({...editForm!, yearsOfExperience: e.target.value})} /> : data.yearsOfExperience}
                                        </td>

                                        <td className="py-4 px-4 align-top">
                                            {isEditing ? <textarea className="w-full p-2 border rounded text-xs h-20" value={data.positionExperience} onChange={e => setEditForm({...editForm!, positionExperience: e.target.value})} /> : <div className="text-xs text-gray-600 w-64 leading-relaxed whitespace-pre-wrap">{data.positionExperience}</div>}
                                        </td>
                                        
                                        <td className="py-4 px-4 align-top">
                                            {isEditing ? <textarea className="w-full p-2 border rounded text-xs" value={data.currentCompany} onChange={e => setEditForm({...editForm!, currentCompany: e.target.value})} /> : <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.currentCompany}</div>}
                                        </td>
                                        
                                        <td className="py-4 px-4 align-top space-y-2">
                                            {isEditing ? (
                                                <>
                                                    <select className="w-full p-1 border rounded text-xs" value={data.intent} onChange={e => setEditForm({...editForm!, intent: e.target.value})}><option value="在职，稳定">在职，稳定</option><option value="在职，看机会">在职，看机会</option><option value="离职，不考虑">离职，不考虑</option><option value="离职，看机会">离职，看机会</option><option value="未知">未知</option></select>
                                                    <select className="w-full p-1 border rounded text-xs" value={data.isEmployed} onChange={e => setEditForm({...editForm!, isEmployed: e.target.value})}><option value="在职">在职</option><option value="离职">离职</option><option value="未知">未知</option></select>
                                                </>
                                            ) : (
                                                <div className="text-xs space-y-1">
                                                    <div className="font-medium px-2 py-0.5 bg-gray-100 rounded inline-block">{data.intent}</div>
                                                    <div className="text-gray-500 px-2">{data.isEmployed}</div>
                                                </div>
                                            )}
                                        </td>

                                        <td className="py-4 px-4 align-top">
                                            {isEditing ? <input className="w-full p-2 border rounded" value={data.location} onChange={e => setEditForm({...editForm!, location: e.target.value})} /> : data.location}
                                        </td>

                                        <td className="py-4 px-4 align-top">
                                            {isEditing ? <input className="w-full p-2 border rounded text-xs" value={data.contact} onChange={e => setEditForm({...editForm!, contact: e.target.value})} /> : <div className="text-xs font-mono">{data.contact}</div>}
                                        </td>

                                        <td className="py-4 px-4 align-top">
                                             {isEditing ? (
                                                 <textarea className="w-full p-2 border rounded text-xs h-20" value={data.aiPersona} onChange={e => setEditForm({...editForm!, aiPersona: e.target.value})} />
                                             ) : (
                                                 <div className="w-48">
                                                    <div className="text-xs text-purple-700 bg-purple-50 p-2 rounded mb-1 leading-relaxed whitespace-pre-wrap">{data.aiPersona || '暂无画像'}</div>
                                                 </div>
                                             )}
                                        </td>

                                        <td className="py-4 px-4 align-top">
                                            {isEditing ? (
                                                 <>
                                                    <input className="w-full p-1 border rounded text-xs mb-1" placeholder="来源" value={data.source} onChange={e => setEditForm({...editForm!, source: e.target.value})} />
                                                    <textarea className="w-full p-1 border rounded text-xs h-24" placeholder="备注" value={data.notes} onChange={e => setEditForm({...editForm!, notes: e.target.value})} />
                                                 </>
                                            ) : (
                                                <div className="text-xs w-64 space-y-2">
                                                    {data.source && (
                                                        <div className="text-gray-500 bg-gray-50 px-2 py-1 rounded break-all">
                                                            <span className="mr-1">源:</span>
                                                            {/^(http|https):\/\//.test(data.source) ? (
                                                                <a 
                                                                    href={data.source} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="text-blue-600 hover:underline cursor-pointer"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    {data.source}
                                                                </a>
                                                            ) : (
                                                                data.source
                                                            )}
                                                        </div>
                                                    )}
                                                    {data.notes && <div className="text-gray-900 whitespace-pre-wrap leading-relaxed">{data.notes}</div>}
                                                </div>
                                            )}
                                        </td>

                                        <td className="py-4 px-4 align-top text-xs text-gray-400">
                                            {data.lastModified?.split(' ')[0] || data.dateAdded}
                                        </td>

                                        <td className="py-4 px-4 sticky right-0 bg-white group-hover:bg-blue-50/50 border-l border-gray-100 text-center align-top">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-2">
                                                    <button onClick={saveEdit} className="p-1.5 bg-green-600 text-white rounded text-xs flex items-center justify-center gap-1 hover:bg-green-700">
                                                        <Save size={14} /> 保存
                                                    </button>
                                                    <button onClick={cancelEdit} className="p-1.5 bg-gray-200 text-gray-700 rounded text-xs flex items-center justify-center gap-1 hover:bg-gray-300">
                                                        <X size={14} /> 取消
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2 items-center">
                                                    <button onClick={() => startEdit(c)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded w-full flex items-center justify-center bg-white border border-gray-100 shadow-sm" title="编辑">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <div className="flex gap-2">
                                                        {c.fileName && (
                                                            <button onClick={() => fileSystem.openResumeFile(c.fileName)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded bg-white border border-gray-100 shadow-sm" title="查看简历">
                                                                <FileText size={14} />
                                                            </button>
                                                        )}
                                                        <button onClick={async () => {
                                                            if(confirm('确定删除该人才及相关文件吗？')) {
                                                                const newList = candidates.filter(x => x.id !== c.id);
                                                                setCandidates(newList);
                                                                await fileSystem.writeDatabase(newList);
                                                                if(c.fileName) await fileSystem.deleteResumeFile(c.fileName);
                                                            }
                                                        }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded bg-white border border-gray-100 shadow-sm" title="删除">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 border-t border-gray-200 text-xs text-gray-500 text-right bg-white z-20">
                    共 {filtered.length} 条记录
                </div>
            </div>
        </div>
    );
  };

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-8">
        <h2 className="text-2xl font-bold text-gray-800">系统设置</h2>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <h3 className="text-lg font-bold border-b border-gray-100 pb-3 mb-4">基本配置</h3>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">存储路径 (Google Drive / 本地)</label>
                <div className="flex gap-3">
                    <input disabled value="当前已授权文件夹 (相对路径模式)" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-gray-500 text-sm" />
                    <button onClick={handleReconnect} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-black">更改/重新授权</button>
                </div>
                <p className="text-xs text-gray-400 mt-2">支持 Google Drive 桌面版同步文件夹。数据将以相对路径保存，确保多设备同步时的链接有效性。</p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                <div className="flex gap-3">
                    <input type="password" value={config.apiKey} onChange={(e) => {
                        const newKey = e.target.value;
                        setConfig({...config, apiKey: newKey});
                        localStorage.setItem('talentos_api_key', newKey);
                    }} className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">您的称呼 (系统固定)</label>
                <input value="陈哈哈" disabled className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 outline-none text-gray-500 cursor-not-allowed" />
            </div>

            <div className="pt-6 border-t border-gray-100">
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-red-600 text-sm font-medium hover:underline flex items-center gap-2">
                    <LogOut size={16} /> 清除本地缓存并退出
                </button>
            </div>
        </div>
    </div>
  );

  if (!config.isConfigured || reconnectNeeded) {
      return renderLogin();
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'entry' && renderEntry()}
            {activeTab === 'management' && renderManagement()}
            {activeTab === 'settings' && renderSettings()}
        </div>
      </main>
    </div>
  );
};

export default App;