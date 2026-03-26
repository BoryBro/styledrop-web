"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const STYLES = [
  {
    id: "4k-upscale",
    name: "4K 업스케일링",
    desc: "초고해상도 디테일 복원 및 화질 개선",
    thumbnail: "/thumbnails/4k.jpg",
    goodExample: "/examples/4k-good.jpg",
    badExample: "/examples/4k-bad.jpg",
  },
  {
    id: "flash-selfie",
    name: "플래시셀카",
    desc: "힙한 파티 무드의 아날로그 플래시 샷",
    thumbnail: "/thumbnails/flash.jpg",
    goodExample: "/examples/flash-good.jpg",
    badExample: "/examples/flash-bad.jpg",
  },
];

export default function Home() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isAgreed, setIsAgreed] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMimeType("image/jpeg");
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setResultImage(null);
      
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_SIZE = 1024;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setImageBase64(dataUrl.split(",")[1]);
        }
      };
      img.src = url;
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!selectedStyle) {
      alert("스타일을 선택해주세요.");
      return;
    }
    if (!imageBase64) {
      alert("사진을 업로드해주세요.");
      return;
    }
    
    setIsLoading(true);
    setResultImage(null);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: selectedStyle,
          imageBase64,
          mimeType
        })
      });
      
      const data = await response.json();
      if (data.image) {
        setResultImage(`data:image/jpeg;base64,${data.image}`);
      } else {
        alert("이미지 변환에 실패했습니다: " + (data.error || "서버 오류"));
      }
    } catch (error) {
      console.error(error);
      alert("요청 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = `styledrop_${selectedStyle}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-12 md:py-16 flex flex-col min-h-screen">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 text-white">
          StyleDrop
        </h1>
        <p className="text-foreground/70 font-medium">
          사진 한 장, 감성은 AI가
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4 px-1 text-white">스타일 선택</h2>
        <div className="grid grid-cols-2 gap-4">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id === selectedStyle ? null : style.id)}
              className={`rounded-2xl flex flex-col text-left transition-all duration-300 border-2 overflow-hidden ${
                selectedStyle === style.id
                  ? "border-point bg-card/80 shadow-[0_4px_20px_rgb(201,87,26,0.2)]"
                  : "border-transparent bg-card hover:bg-white/5"
              }`}
            >
              {/* Thumbnail */}
              <div className="w-full aspect-[4/3] bg-white/5 overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={style.thumbnail}
                  alt={style.name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div className="p-4 flex flex-col justify-end">
                <h3 className={`text-base md:text-lg font-bold mb-1.5 transition-colors ${selectedStyle === style.id ? "text-point" : "text-white"}`}>
                  {style.name}
                </h3>
                <p className="text-xs text-foreground/60 leading-relaxed font-medium break-keep">
                  {style.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-auto">
        {/* Style Guide Section */}
        {selectedStyle && !resultImage && (() => {
          const style = STYLES.find(s => s.id === selectedStyle);
          if (!style) return null;
          return (
            <div className="mb-6 rounded-2xl bg-[#1A1A1A] border border-white/5 p-4">
              <p className="text-xs font-bold tracking-widest text-white/40 mb-3 uppercase">사진 가이드</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-green-400 font-bold text-sm">O</span>
                    <span className="text-xs text-white/50 font-medium">이런 사진 추천</span>
                  </div>
                  <div className="w-full aspect-square rounded-xl bg-white/5 overflow-hidden flex items-center justify-center border border-green-400/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={style.goodExample}
                      alt="Good example"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-400 font-bold text-sm">X</span>
                    <span className="text-xs text-white/50 font-medium">이런 사진 지양</span>
                  </div>
                  <div className="w-full aspect-square rounded-xl bg-white/5 overflow-hidden flex items-center justify-center border border-red-400/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={style.badExample}
                      alt="Bad example"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <h2 className="text-lg font-bold mb-4 px-1 text-white">
          {resultImage ? "변환 결과 비교" : "사진 업로드"}
        </h2>
        
        {resultImage ? (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
             {/* BEFORE Image */}
             <div className="flex flex-col gap-3">
               <div className="relative w-full rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden flex items-center justify-center">
                 <span className="absolute top-4 left-4 z-10 text-xs font-bold tracking-widest text-white bg-black/60 backdrop-blur-sm py-1.5 px-3 rounded-full">BEFORE</span>
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={previewUrl!} alt="Original Image" className="w-full h-auto object-contain max-h-[60vh] md:max-h-[70vh]" />
               </div>
             </div>
             
             {/* AFTER Image */}
             <div className="flex flex-col gap-3">
               <div className="relative w-full rounded-2xl border-2 border-point/50 bg-[#1A1A1A] overflow-hidden flex items-center justify-center shadow-[0_4px_20px_rgb(201,87,26,0.15)]">
                 <span className="absolute top-4 left-4 z-10 text-xs font-bold tracking-widest text-white bg-point/80 backdrop-blur-sm py-1.5 px-3 rounded-full">AFTER</span>
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={resultImage} alt="Generated Result" className="w-full h-auto object-contain max-h-[60vh] md:max-h-[70vh]" />
               </div>
               <button 
                 onClick={handleDownload}
                 className="w-full bg-point hover:bg-[#B34A12] text-white py-3.5 md:py-4 rounded-xl text-md font-bold transition-all duration-300 shadow-md shadow-point/20 hover:-translate-y-0.5"
               >
                 다운로드
               </button>
             </div>
           </div>
        ) : (
          <div 
            onClick={handleUploadClick}
            className={`w-full aspect-[4/3] sm:aspect-video rounded-2xl border-2 border-dashed bg-card flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group ${isLoading ? 'border-white/10 opacity-50 cursor-not-allowed' : 'border-white/20 hover:border-point/50'}`}
          >
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {!isLoading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">사진 변경하기</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-6 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4 text-white/40 group-hover:text-point transition-colors group-hover:bg-point/10">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                     <polyline points="17 8 12 3 7 8" />
                     <line x1="12" y1="3" x2="12" y2="15" />
                   </svg>
                </div>
                <p className="text-white/80 font-medium text-lg">사진을 업로드하세요</p>
                <p className="text-sm text-white/40 mt-2">클릭하여 파일 선택 (JPG, PNG)</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={isLoading ? undefined : handleFileChange} 
              accept="image/*" 
              className="hidden" 
              disabled={isLoading}
            />
          </div>
        )}
      </section>

      <div className="mt-8 mb-4 min-h-[60px] flex justify-center items-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-3">
             <div className="w-8 h-8 border-4 border-point/30 border-t-point rounded-full animate-spin"></div>
             <p className="text-point font-medium animate-pulse">AI가 사진의 감성을 변환하고 있습니다...</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-8 mt-auto grid grid-cols-1 gap-3">
        {resultImage ? (
           <button 
             onClick={() => {
               setResultImage(null);
               setPreviewUrl(null);
               setImageBase64(null);
               setSelectedStyle(null);
               if (fileInputRef.current) fileInputRef.current.value = "";
             }}
             className="w-full bg-[#2A2A2A] hover:bg-[#333] text-white py-4 rounded-2xl text-lg font-bold transition-all duration-300"
           >
             새로운 사진 만들기
           </button>
        ) : (
           <div className="flex flex-col gap-4">
             <div className="flex flex-col gap-2 px-1">
               <p className="text-[11px] md:text-xs text-white/40 font-medium">
                 업로드된 사진은 서버에 저장되지 않으며, AI 처리 후 즉시 삭제됩니다.
               </p>
               <label className="flex items-center gap-3 cursor-pointer group w-fit">
                 <div className="relative flex items-center justify-center">
                   <input
                     type="checkbox"
                     checked={isAgreed}
                     onChange={(e) => setIsAgreed(e.target.checked)}
                     className="peer appearance-none w-5 h-5 rounded border-2 border-white/20 checked:border-point checked:bg-point transition-colors cursor-pointer"
                   />
                   <svg
                     className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                     viewBox="0 0 14 10"
                     fill="none"
                     xmlns="http://www.w3.org/2000/svg"
                   >
                     <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                 </div>
                 <span className="text-sm md:text-base text-white/80 font-medium select-none group-hover:text-white transition-colors">
                   <Link href="/terms" className="text-point hover:underline underline-offset-4" target="_blank">이용약관</Link> 및 <Link href="/privacy" className="text-point hover:underline underline-offset-4" target="_blank">개인정보처리방침</Link>에 동의합니다.
                 </span>
               </label>
             </div>
             <button 
               onClick={handleSubmit}
               disabled={isLoading || !isAgreed}
               className={`w-full py-4 md:py-5 rounded-2xl text-lg md:text-xl font-bold transition-all duration-300 ${
                 isLoading || !isAgreed
                   ? "bg-[#2A2A2A] text-white/30 cursor-not-allowed" 
                   : "bg-point hover:bg-[#B34A12] text-white shadow-lg shadow-point/20 hover:shadow-point/40 hover:-translate-y-1 active:translate-y-0"
               }`}
             >
               {isLoading ? "처리 중..." : "만들기"}
             </button>
           </div>
        )}
      </div>
      <footer className="mt-16 text-center flex flex-col items-center justify-center gap-2 pb-6">
        <div className="flex gap-4 text-xs font-medium text-white/40">
          <Link href="/terms" className="hover:text-white transition-colors underline-offset-4 hover:underline">이용약관</Link>
          <span>|</span>
          <Link href="/privacy" className="hover:text-white transition-colors underline-offset-4 hover:underline">개인정보처리방침</Link>
        </div>
        <p className="text-[10px] text-white/20">&copy; {new Date().getFullYear()} StyleDrop. All rights reserved.</p>
      </footer>
    </main>
  );
}
