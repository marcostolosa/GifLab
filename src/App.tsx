import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { 
  Upload, Download, Play, Pause, Settings, FileVideo, Sparkles, Zap, Timer,
  Scissors, Image, Filter, Layers, Share2, History, Moon, Sun, Maximize2,
  RotateCcw, RotateCw, Sliders, Eye, Palette, Wand2, Crown
} from "lucide-react";

const CORE_VERSION = "0.12.10";
const MIRRORS = [
  () => ({ base: "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd", label: "unpkg MT" }),
  () => ({ base: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd", label: "unpkg" }),
];

const ffmpeg = new FFmpeg();
let ffmpegLoaded = false;

interface GeneratedGif {
  id: string;
  url: string;
  blob: Blob;
  timestamp: number;
  settings: {
    duration: number;
    width: number;
    height: number | "auto";
    fps: number;
    quality: string;
    filters?: string[];
    watermark?: string;
  };
  thumbnails?: string[];
}

interface FilterOption {
  id: string;
  name: string;
  value: string;
  icon: React.ComponentType<any>;
}

interface WatermarkSettings {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  fontSize: number;
  color: string;
  opacity: number;
}

export default function GifLabPro() {
  const [ready, setReady] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Inicializando FFmpeg...");
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Configurações do GIF
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(3);
  const [width, setWidth] = useState(480);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [fps, setFps] = useState(15);
  const [quality, setQuality] = useState<"fast" | "balanced" | "best">("balanced");
  const [loop, setLoop] = useState(true);

  // Estados premium (leves)
  const [darkMode, setDarkMode] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [showPresets, setShowPresets] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>('custom');

  // Estados de geração
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGif, setCurrentGif] = useState<GeneratedGif | null>(null);
  const [gifHistory, setGifHistory] = useState<GeneratedGif[]>([]);

  // Preview do trecho selecionado
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewGif, setPreviewGif] = useState<string | null>(null);

  // Presets rápidos para usuários
  const quickPresets = useMemo(() => [
    { id: 'social', name: '📱 Redes Sociais', width: 480, height: 480, fps: 15, quality: 'balanced' as const },
    { id: 'web', name: '🌐 Web/Blog', width: 600, height: 'auto' as const, fps: 12, quality: 'fast' as const },
    { id: 'hd', name: '🎬 Alta Qualidade', width: 720, height: 'auto' as const, fps: 20, quality: 'best' as const },
    { id: 'mini', name: '⚡ Ultra Leve', width: 320, height: 'auto' as const, fps: 10, quality: 'fast' as const }
  ], []);

  const quickFilters = useMemo(() => [
    { id: 'none', name: 'Original', value: '' },
    { id: 'sharpen', name: '🔪 Nitidez', value: 'unsharp=5:5:1.0:5:5:0.0' },
    { id: 'vintage', name: '📸 Vintage', value: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131' },
    { id: 'bright', name: '☀️ Brilho+', value: 'eq=brightness=0.1:contrast=1.1' }
  ], []);

  // Função para aplicar preset rapidamente
  const applyPreset = useCallback((preset: typeof quickPresets[0]) => {
    setWidth(preset.width);
    setHeight(preset.height);
    setFps(preset.fps);
    setQuality(preset.quality);
    setCurrentPreset(preset.id);
    setShowPresets(false);
  }, []);

  // Setup do FFmpeg com logs elegantes
  useEffect(() => {
    const onLog = (e: any) => {
      if (e?.message && !e.message.includes("libx264")) {
        setLoadingMsg(e.message.slice(0, 60) + (e.message.length > 60 ? "..." : ""));
      }
    };

    const onProgress = (e: any) => {
      if (typeof e?.progress === "number") {
        const progress = Math.round(e.progress * 100);
        setGenerationProgress(progress);
        setLoadingMsg(`Processando... ${progress}%`);
      }
    };

    ffmpeg.on("log", onLog);
    ffmpeg.on("progress", onProgress);
    return () => {
      ffmpeg.off("log", onLog);
      ffmpeg.off("progress", onProgress);
    };
  }, []);

  // Carregamento do FFmpeg
  useEffect(() => {
    (async () => {
      if (ffmpegLoaded) { 
        setReady(true); 
        setLoadingMsg("FFmpeg carregado com sucesso!");
        return; 
      }

      for (const [index, makeMirror] of MIRRORS.entries()) {
        const { base, label } = makeMirror();
        try {
          setLoadingMsg(`Carregando de ${label}... (${index + 1}/${MIRRORS.length})`);
          
          const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
          const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm");
          const workerURL = await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript");
          
          await loadWithTimeout(() => ffmpeg.load({ coreURL, wasmURL, workerURL }), 30000);
          
          ffmpegLoaded = true;
          setReady(true);
          setLoadingMsg("FFmpeg carregado com sucesso!");
          return;
        } catch (err) {
          console.warn(`Mirror ${label} falhou:`, err);
          setLoadingMsg(`Mirror ${label} falhou. Tentando próximo...`);
        }
      }
      setLoadingMsg("❌ Falha ao carregar FFmpeg. Tente recarregar a página.");
    })();
  }, []);

  // Drag & Drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files[0] && files[0].type.startsWith("video/")) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileSelection = useCallback((selectedFile: File) => {
    setCurrentGif(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    
    const url = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setVideoUrl(url);
  }, [videoUrl]);

  const onLoadedMetadata = useCallback(() => {
    const duration = videoRef.current?.duration || 0;
    if (duration > 0) {
      setVideoDuration(duration);
      setEnd(Math.min(3, Math.floor(duration)));
    }
  }, []);

  const playPreview = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = start;
    videoRef.current.play();
    setIsPlayingPreview(true);
    
    const checkTime = () => {
      if (!videoRef.current) return;
      if (videoRef.current.currentTime >= end) {
        videoRef.current.pause();
        videoRef.current.currentTime = start;
        setIsPlayingPreview(false);
      } else {
        requestAnimationFrame(checkTime);
      }
    };
    requestAnimationFrame(checkTime);
  }, [start, end]);

  const pausePreview = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlayingPreview(false);
    }
  }, []);

  // Cálculos dinâmicos
  const selectedDuration = useMemo(() => Math.max(0, end - start), [start, end]);
  
  const estimatedSize = useMemo(() => {
    if (!selectedDuration) return 0;
    const pixelsPerFrame = width * (height === "auto" ? Math.round(width * 0.75) : height);
    const totalFrames = selectedDuration * fps;
    const qualityMultiplier = quality === "fast" ? 0.3 : quality === "balanced" ? 0.5 : 0.8;
    return Math.round((pixelsPerFrame * totalFrames * qualityMultiplier) / 8000); // Aproximação em KB
  }, [selectedDuration, width, height, fps, quality]);

  const buildFilters = useCallback(() => {
    const wh = `${width}:${height === "auto" ? -1 : height}`;
    const baseFilters = [`fps=${fps}`, `scale=${wh}:flags=lanczos`];
    
    const currentFilter = quickFilters.find(f => f.id === selectedFilter);
    if (currentFilter && currentFilter.value) {
      baseFilters.push(currentFilter.value);
    }
    
    return baseFilters.join(",");
  }, [width, height, fps, selectedFilter, quickFilters]);

  const getDitherMode = useCallback((q: typeof quality) => {
    switch (q) {
      case "fast": return "bayer:bayer_scale=3";
      case "balanced": return "sierra2";
      case "best": return "floyd_steinberg";
      default: return "sierra2";
    }
  }, []);

  const generateGif = useCallback(async () => {
    if (!file || selectedDuration <= 0) return;
    
    setGenerating(true);
    setGenerationProgress(0);
    setCurrentGif(null);

    const timestamp = Date.now();
    const inputName = `input_${timestamp}.${(file.name.split(".").pop() || "mp4").toLowerCase()}`;
    const paletteName = `palette_${timestamp}.png`;
    const outputName = `output_${timestamp}.gif`;

    try {
      setLoadingMsg("Preparando arquivo...");
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      setLoadingMsg("Gerando paleta otimizada...");
      await ffmpeg.exec([
        "-ss", String(start),
        "-t", String(selectedDuration),
        "-i", inputName,
        "-vf", `${buildFilters()},palettegen=stats_mode=full:max_colors=256`,
        "-y", paletteName,
      ]);

      setLoadingMsg("Criando GIF com alta qualidade...");
      const args = [
        "-ss", String(start),
        "-t", String(selectedDuration),
        "-i", inputName,
        "-i", paletteName,
        "-filter_complex", `[0:v]${buildFilters()}[v];[v][1:v]paletteuse=dither=${getDitherMode(quality)}:diff_mode=rectangle`,
        ...(loop ? ["-loop", "0"] : ["-loop", "-1"]),
        "-y", outputName,
      ];
      
      await ffmpeg.exec(args);

      setLoadingMsg("Finalizando...");
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: "image/gif" });
      const url = URL.createObjectURL(blob);

      const newGif: GeneratedGif = {
        id: String(timestamp),
        url,
        blob,
        timestamp,
        settings: {
          duration: selectedDuration,
          width,
          height,
          fps,
          quality,
        }
      };

      setCurrentGif(newGif);
      setGifHistory(prev => [newGif, ...prev.slice(0, 4)]); // Manter apenas os 5 mais recentes
      setLoadingMsg("✨ GIF criado com sucesso!");

    } catch (error) {
      console.error("Erro na geração:", error);
      setLoadingMsg("❌ Erro ao gerar GIF. Tente novamente.");
    } finally {
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(paletteName);
        await ffmpeg.deleteFile(outputName);
      } catch {}
      setGenerating(false);
      setGenerationProgress(0);
    }
  }, [file, selectedDuration, start, buildFilters, getDitherMode, quality, loop, width, height, fps]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">GifLab Pro</h1>
            <div className="space-y-3">
              <div className="bg-white/10 rounded-2xl p-4">
                <div className="text-white/90 text-sm mb-2">{loadingMsg}</div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                       style={{ width: `${loadingProgress}%` }} />
                </div>
              </div>
              <p className="text-white/70 text-xs">Primeira inicialização pode levar 30-60s</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header premium com controles */}
      <header className="bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center relative">
                <Crown className="w-6 h-6 text-white" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">GifLab Pro</h1>
                <p className="text-purple-200/80 text-sm">Conversor profissional de vídeo para GIF</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Presets rápidos */}
              <div className="relative">
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-white/90 text-sm font-medium transition-all"
                >
                  <Zap className="w-4 h-4" />
                  Presets
                </button>
                {showPresets && (
                  <div className="absolute right-0 top-full mt-2 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-2 min-w-48 z-50">
                    {quickPresets.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                          currentPreset === preset.id 
                            ? 'bg-purple-500/30 text-white' 
                            : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Toggle tema */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white/90 transition-all"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <div className="hidden md:flex items-center gap-2 text-white/60 text-sm">
                <Zap className="w-4 h-4" />
                <span>FFmpeg.wasm</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Área de upload e preview */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Upload Zone */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <FileVideo className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">Vídeo de Entrada</h2>
              </div>

              {!file ? (
                <div
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                    dragOver 
                      ? "border-purple-400 bg-purple-400/10" 
                      : "border-white/30 hover:border-purple-400/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-white text-lg font-medium mb-2">Arraste seu vídeo aqui</h3>
                  <p className="text-white/70 text-sm mb-6">Ou clique para selecionar arquivo</p>
                  <label className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 rounded-2xl text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Escolher Arquivo
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) handleFileSelection(selectedFile);
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                        <FileVideo className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-white/60 text-sm">{(file.size / 1024 / 1024).toFixed(1)} MB • {videoDuration.toFixed(1)}s</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFileSelection(null as any)}
                      className="text-white/60 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {videoUrl && (
                    <div className="space-y-4">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full rounded-2xl border border-white/20"
                        controls
                        onLoadedMetadata={onLoadedMetadata}
                      />
                      
                      {/* Seleção de trecho com preview */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-white font-medium flex items-center gap-2">
                            <Timer className="w-4 h-4" />
                            Selecionar Trecho
                          </h3>
                          <button
                            onClick={isPlayingPreview ? pausePreview : playPreview}
                            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 px-3 py-1.5 rounded-xl text-white text-sm font-medium transition-colors"
                            disabled={selectedDuration <= 0}
                          >
                            {isPlayingPreview ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            Preview
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-white/80">Início: {start.toFixed(1)}s</span>
                              <span className="text-purple-400">{selectedDuration.toFixed(1)}s selecionados</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.floor(videoDuration * 10) / 10}
                              step={0.1}
                              value={start}
                              onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.1))}
                              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-white/80">Fim: {end.toFixed(1)}s</span>
                              <span className="text-white/60">Máx: {videoDuration.toFixed(1)}s</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.floor(videoDuration * 10) / 10}
                              step={0.1}
                              value={end}
                              onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.1))}
                              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Configurações avançadas */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-6">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">Configurações Avançadas</h2>
              </div>

              {/* Filtros rápidos */}
              <div className="mb-6">
                <label className="block text-white/80 text-sm font-medium mb-3">🎨 Filtros Visuais</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {quickFilters.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedFilter(filter.id)}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        selectedFilter === filter.id
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {filter.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">Largura (px)</label>
                  <input
                    type="number"
                    min={64}
                    max={1920}
                    step={8}
                    value={width}
                    onChange={(e) => setWidth(Math.max(64, Number(e.target.value) || 480))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">Altura (px)</label>
                  <input
                    type="text"
                    placeholder="auto"
                    value={height === "auto" ? "" : String(height)}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val === "" || val === "auto") {
                        setHeight("auto");
                      } else {
                        const num = Number(val);
                        if (!isNaN(num) && num >= 64) setHeight(num);
                      }
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">FPS</label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={8}>8 fps (menor)</option>
                    <option value={12}>12 fps</option>
                    <option value={15}>15 fps (padrão)</option>
                    <option value={20}>20 fps</option>
                    <option value={24}>24 fps (suave)</option>
                    <option value={30}>30 fps (alta)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">Qualidade</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as any)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="fast">Rápida (menor qualidade)</option>
                    <option value="balanced">Balanceada (recomendado)</option>
                    <option value="best">Máxima (mais lenta)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <label className="inline-flex items-center gap-3 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-2 border-white/30 bg-white/10 checked:bg-purple-500 checked:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <span className="font-medium">Loop infinito</span>
                </label>
                
                <div className="text-right">
                  <p className="text-purple-200 text-sm font-medium">Tamanho estimado</p>
                  <p className="text-white text-lg font-bold">{estimatedSize} KB</p>
                </div>
              </div>

              <button
                disabled={!file || generating || selectedDuration <= 0}
                onClick={generateGif}
                className="mt-6 w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-50 px-8 py-4 rounded-2xl text-white font-bold text-lg shadow-2xl transition-all duration-300 transform hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-3"
              >
                {generating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gerando... {generationProgress}%
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Criar GIF Profissional
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Painel lateral - Resultado e Histórico */}
          <div className="space-y-6">
            
            {/* Resultado atual */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <Download className="w-5 h-5 text-green-400" />
                Resultado
              </h2>

              {generating && (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <div className="w-8 h-8 border-3 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      </div>
                      <p className="text-white font-medium mb-2">{loadingMsg}</p>
                      <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                          style={{ width: `${generationProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!generating && !currentGif && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-white/40" />
                  </div>
                  <p className="text-white/60">Seu GIF aparecerá aqui</p>
                </div>
              )}

              {currentGif && (
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                    <img 
                      src={currentGif.url} 
                      alt="GIF gerado" 
                      className="w-full h-auto"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-white/80">
                      <p>{(currentGif.blob.size / 1024).toFixed(1)} KB</p>
                      <p>{currentGif.settings.duration}s • {currentGif.settings.fps} fps</p>
                    </div>
                    
                    <a
                      href={currentGif.url}
                      download={`giflab_pro_${currentGif.timestamp}.gif`}
                      className="flex items-center gap-2 bg-green-500 hover:bg-green-600 px-6 py-3 rounded-2xl text-white font-medium transition-colors shadow-lg"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Histórico */}
            {gifHistory.length > 0 && (
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Histórico Recente</h3>
                <div className="space-y-3">
                  {gifHistory.slice(0, 3).map((gif) => (
                    <div key={gif.id} className="bg-white/5 rounded-xl p-3 border border-white/10 flex items-center gap-3">
                      <img src={gif.url} alt="GIF" className="w-12 h-12 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white/90 text-sm font-medium truncate">
                          {(gif.blob.size / 1024).toFixed(1)} KB • {gif.settings.duration}s
                        </p>
                        <p className="text-white/60 text-xs">
                          {gif.settings.width}×{gif.settings.height} • {gif.settings.fps}fps
                        </p>
                      </div>
                      <a
                        href={gif.url}
                        download={`giflab_pro_${gif.timestamp}.gif`}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dicas profissionais */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-3xl border border-purple-500/20 p-6">
              <h3 className="text-white font-semibold mb-3">💡 Dicas Profissionais</h3>
              <ul className="text-white/80 text-sm space-y-2">
                <li>• <strong>Performance:</strong> Mantenha duração ≤ 10s para melhor qualidade</li>
                <li>• <strong>Tamanho:</strong> 480px de largura é ideal para web</li>
                <li>• <strong>Suavidade:</strong> 15-20 FPS para movimento natural</li>
                <li>• <strong>Qualidade:</strong> Mode "Máxima" para resultados profissionais</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* CSS customizado para sliders */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #a855f7, #ec4899);
          cursor: pointer;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #a855f7, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

async function loadWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: any;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}