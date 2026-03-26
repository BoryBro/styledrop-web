"use client";

import { useState, useRef } from "react";

const STYLES = [
  { id: "4k-upscale", name: "4K 업스케일링", desc: "초고해상도 디테일 복원 및 화질 개선" },
  { id: "flash-selfie", name: "플래시셀카", desc: "힙한 파티 무드의 아날로그 플래시 샷" }
];

export default function Home() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  
  const [isLoading, setIsLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  
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
              className={`rounded-2xl p-5 flex flex-col justify-end text-left transition-all duration-300 border-2 aspect-[4/5] ${
                selectedStyle === style.id
                  ? "border-point bg-card/80 shadow-[0_4px_20px_rgb(201,87,26,0.2)]"
                  : "border-transparent bg-card hover:bg-white/5"
              }`}
            >
              <div className="mt-auto flex flex-col justify-end h-full">
                <h3 className={`text-xl md:text-2xl font-bold mb-3 transition-colors ${selectedStyle === style.id ? "text-point" : "text-white"}`}>
                  {style.name}
                </h3>
                <p className="text-xs md:text-sm text-foreground/60 leading-relaxed font-medium break-keep">
                  {style.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-auto">
        <h2 className="text-lg font-bold mb-4 px-1 text-white">
          {resultImage ? "변환 결과 비교" : "사진 업로드"}
        </h2>
        
        {resultImage ? (
           <div className="grid grid-cols-2 gap-4">
             {/* BEFORE Image */}
             <div className="flex flex-col gap-2">
               <span className="text-xs font-bold tracking-widest text-foreground/50 bg-[#1A1A1A] py-1 px-3 rounded-full self-start">BEFORE</span>
               <div className="w-full aspect-square rounded-2xl border border-white/10 bg-[#1A1A1A] overflow-hidden">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={previewUrl!} alt="Original Image" className="w-full h-full object-cover" />
               </div>
             </div>
             
             {/* AFTER Image */}
             <div className="flex flex-col gap-2">
               <span className="text-xs font-bold tracking-widest text-point bg-point/10 py-1 px-3 rounded-full self-start">AFTER</span>
               <div className="w-full aspect-square rounded-2xl border-2 border-point/50 bg-[#1A1A1A] overflow-hidden">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={resultImage} alt="Generated Result" className="w-full h-full object-cover" />
               </div>
               <button 
                 onClick={handleDownload}
                 className="mt-2 w-full bg-point hover:bg-[#B34A12] text-white py-3 rounded-xl text-sm font-bold transition-all duration-300 shadow-md shadow-point/20"
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
           <button 
             onClick={handleSubmit}
             disabled={isLoading}
             className={`w-full py-4 md:py-5 rounded-2xl text-lg md:text-xl font-bold transition-all duration-300 ${
               isLoading 
                 ? "bg-point/50 cursor-not-allowed text-white/50" 
                 : "bg-point hover:bg-[#B34A12] text-white shadow-lg shadow-point/20 hover:shadow-point/40 hover:-translate-y-1 active:translate-y-0"
             }`}
           >
             {isLoading ? "처리 중..." : "만들기"}
           </button>
        )}
      </div>
    </main>
  );
}
