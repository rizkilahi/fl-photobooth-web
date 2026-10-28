import { describe, it, expect } from "vitest";
import {
  PHOTO_W, PHOTO_H, STRIP_W, STRIP_H, SHOTS, PAD, GAP, FOOTER_TOP, RAW_W, RAW_H,
  FILTERS, toCss, cropRect, applyFilterToData, applyPixelFilter, detectCtxFilter,
  seeded, formatDate, fileName, fontStack, fontSpec, fitFont, cameraErrorMessage,
  needsRefilter, printLayout,
} from "../lib.js";

describe("konstanta layout", () => {
  it("strip 2x6 inci @300dpi, foto 3:2", () => {
    expect([STRIP_W, STRIP_H]).toEqual([600, 1800]);
    expect([PHOTO_W, PHOTO_H]).toEqual([528, 352]);
    expect(PHOTO_W / PHOTO_H).toBeCloseTo(1.5, 5);
    expect([RAW_W, RAW_H]).toEqual([1056, 704]);
    expect(FOOTER_TOP).toBe(PAD + SHOTS * PHOTO_H + (SHOTS - 1) * GAP);
    expect(FOOTER_TOP).toBe(1492);
  });
});

describe("cropRect (crop tengah 3:2)", () => {
  const ratio = (r) => r.sw / r.sh;
  it("16:9 -> dibatasi tinggi, crop kiri-kanan", () => {
    const r = cropRect(1920, 1080);
    expect(r).toEqual({ sx: 150, sy: 0, sw: 1620, sh: 1080 });
    expect(ratio(r)).toBeCloseTo(1.5, 10);
  });
  it("4:3 -> dibatasi lebar, crop atas-bawah", () => {
    const r = cropRect(1280, 960);
    expect(r.sw).toBe(1280);
    expect(r.sh).toBeCloseTo(853.3333, 3);
    expect(r.sx).toBe(0);
    expect(r.sy).toBeCloseTo((960 - 853.3333) / 2, 3);
    expect(ratio(r)).toBeCloseTo(1.5, 10);
  });
  it("sudah 3:2 -> tanpa crop", () => {
    expect(cropRect(1500, 1000)).toEqual({ sx: 0, sy: 0, sw: 1500, sh: 1000 });
  });
  it("portrait -> tetap 3:2 dan di dalam frame", () => {
    const r = cropRect(720, 1280);
    expect(ratio(r)).toBeCloseTo(1.5, 10);
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.sw).toBeLessThanOrEqual(720 + 1e-9);
    expect(r.sy + r.sh).toBeLessThanOrEqual(1280 + 1e-9);
  });
});

describe("toCss", () => {
  it("kosong -> none", () => { expect(toCss({})).toBe("none"); });
  it("urutan tetap: grayscale, sepia, saturate, brightness, contrast", () => {
    expect(toCss({ contrast: 1.2, grayscale: 1, brightness: 0.9 })).toBe("grayscale(1) brightness(0.9) contrast(1.2)");
    expect(toCss({ saturate: 0.8, sepia: 0.4 })).toBe("sepia(0.4) saturate(0.8)");
  });
  it("8 filter, id unik, nilai sesuai definisi", () => {
    expect(FILTERS.map((f) => f.id)).toEqual(["normal", "bw", "sepia", "vintage", "warm", "pop", "noir", "fade"]);
    expect(toCss(FILTERS.find((f) => f.id === "bw").p)).toBe("grayscale(1) contrast(1.15)");
    expect(toCss(FILTERS.find((f) => f.id === "vintage").p)).toBe("sepia(0.4) saturate(0.8) brightness(1.08) contrast(0.9)");
    expect(toCss(FILTERS.find((f) => f.id === "normal").p)).toBe("none");
  });
});

describe("applyFilterToData (matriks piksel vs rumus)", () => {
  const clamp = (v) => Math.min(255, Math.max(0, v));
  const px = (r, g, b, a = 255) => new Uint8ClampedArray([r, g, b, a]);
  const run = (rgb, p) => Array.from(applyFilterToData(px(...rgb), p));

  it("normal ({}) tidak mengubah apa pun", () => {
    expect(run([12, 200, 99], {})).toEqual([12, 200, 99, 255]);
  });
  it("grayscale(1) = luma Rec.709 (0.2126, 0.7152, 0.0722)", () => {
    const [r, g, b] = [200, 100, 50];
    const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    expect(run([r, g, b], { grayscale: 1 })).toEqual([y, y, y, 255]);
  });
  it("merah murni grayscale(1) -> abu ≈54", () => {
    expect(run([255, 0, 0], { grayscale: 1 })).toEqual([54, 54, 54, 255]);
  });
  it("sepia(1) = matriks sepia standar, dengan clamp 255", () => {
    const [r, g, b] = [100, 150, 200];
    const exp = [
      clamp(0.393 * r + 0.769 * g + 0.189 * b),
      clamp(0.349 * r + 0.686 * g + 0.168 * b),
      clamp(0.272 * r + 0.534 * g + 0.131 * b),
    ].map(Math.round);
    expect(run([r, g, b], { sepia: 1 }).slice(0, 3)).toEqual(exp);
  });
  it("saturate(0) = grayscale(1) pada rumus saturate; saturate(1) = identitas", () => {
    const [r, g, b] = [180, 90, 30];
    const y = Math.round(0.213 * r + 0.715 * g + 0.072 * b);
    expect(run([r, g, b], { saturate: 0 }).slice(0, 3)).toEqual([y, y, y]);
    expect(run([r, g, b], { saturate: 1 }).slice(0, 3)).toEqual([r, g, b]);
  });
  it("brightness mengalikan; contrast = c*v + 255*(0.5-0.5c); hasil di-clamp", () => {
    expect(run([100, 200, 250], { brightness: 1.2 }).slice(0, 3)).toEqual([120, 240, 255]);
    const c = 1.6, off = 255 * (0.5 - 0.5 * c);
    expect(run([100, 128, 200], { contrast: c }).slice(0, 3)).toEqual([100, 128, 200].map((v) => Math.round(clamp(v * c + off))));
  });
  // Golden value dari ctx.filter Chrome NYATA (HeadlessChrome 145, Linux), diambil 2026-10-28: canvas 1x1 diisi
  // rgb(r,g,b), `ctx.filter = <string CSS>` (urutan seperti toCss: grayscale, sepia, saturate, brightness, contrast),
  // drawImage ke canvas 1x1 lain, getImageData. Angka di bawah LITERAL hasil Chrome, bukan hasil rumus lib.js.
  // Toleransi ±2: Chrome membulatkan di tiap tahap filter, sedangkan fallback piksel membulatkan sekali di akhir.
  // Sekaligus bukti AC-03.3 (fallback piksel visual setara ctx.filter).
  // Cara reproduksi di DevTools Console Chrome pada http://localhost:8000 (lihat juga README.md bagian Pengembangan):
  //   import("./lib.js").then(({ FILTERS, toCss }) => {
  //     const inputs = [[120,80,200],[200,150,100],[30,200,60],[240,240,240]];
  //     const s = document.createElement("canvas"), d = document.createElement("canvas"); s.width = s.height = d.width = d.height = 1;
  //     const sx = s.getContext("2d"), dx = d.getContext("2d"), out = {};
  //     for (const { id, p } of FILTERS.filter((f) => f.id !== "normal")) {
  //       const css = toCss(p);
  //       out[id] = { css, rows: inputs.map(([r,g,b]) => { sx.fillStyle = `rgb(${r},${g},${b})`; sx.fillRect(0,0,1,1); dx.clearRect(0,0,1,1); dx.filter = css; dx.drawImage(s,0,0); return [[r,g,b], [...dx.getImageData(0,0,1,1).data.slice(0,3)]]; }) };
  //     }
  //     console.log(JSON.stringify(out));
  //   });
  const TOL = 2;
  const GOLDEN = {
    bw: { css: "grayscale(1) contrast(1.15)", rows: [[[120, 80, 200], [92, 92, 92]], [[200, 150, 100], [161, 161, 161]], [[30, 200, 60], [157, 157, 157]], [[240, 240, 240], [255, 255, 255]]] },
    sepia: { css: "sepia(0.85) contrast(1.05)", rows: [[[120, 80, 200], [143, 122, 115]], [[200, 150, 100], [215, 186, 140]], [[30, 200, 60], [156, 165, 112]], [[240, 240, 240], [255, 255, 231]]] },
    vintage: { css: "sepia(0.4) saturate(0.8) brightness(1.08) contrast(0.9)", rows: [[[120, 80, 200], [136, 111, 159]], [[200, 150, 100], [204, 174, 137]], [[30, 200, 60], [111, 185, 108]], [[240, 240, 240], [242, 242, 242]]] },
    warm: { css: "sepia(0.2) saturate(1.35) brightness(1.05)", rows: [[[120, 80, 200], [139, 89, 217]], [[200, 150, 100], [226, 163, 94]], [[30, 200, 60], [27, 214, 46]], [[240, 240, 240], [255, 255, 243]]] },
    pop: { css: "saturate(1.8) contrast(1.15)", rows: [[[120, 80, 200], [139, 56, 255]], [[200, 150, 100], [249, 146, 42]], [[30, 200, 60], [0, 253, 0]], [[240, 240, 240], [255, 255, 255]]] },
    noir: { css: "grayscale(1) brightness(0.9) contrast(1.6)", rows: [[[120, 80, 200], [62, 62, 62]], [[200, 150, 100], [149, 149, 149]], [[30, 200, 60], [144, 144, 144]], [[240, 240, 240], [255, 255, 255]]] },
    fade: { css: "saturate(0.6) brightness(1.12) contrast(0.8)", rows: [[[120, 80, 200], [124, 103, 167]], [[200, 150, 100], [188, 162, 135]], [[30, 200, 60], [95, 187, 111]], [[240, 240, 240], [229, 229, 229]]] },
  };
  for (const [id, { css, rows }] of Object.entries(GOLDEN)) {
    it(`filter '${id}' cocok dengan golden value Chrome (±${TOL})`, () => {
      const p = FILTERS.find((f) => f.id === id).p;
      expect(toCss(p)).toBe(css); // string yang diberikan ke Chrome = string yang dipakai app
      for (const [input, expected] of rows) {
        const out = run(input, p).slice(0, 3);
        out.forEach((v, k) => expect(Math.abs(v - expected[k]), `${id} ${input} kanal ${k}: ${v} vs ${expected[k]}`).toBeLessThanOrEqual(TOL));
      }
    });
  }
  it("alpha tidak diubah, banyak piksel diproses semua", () => {
    const d = new Uint8ClampedArray([255, 0, 0, 77, 0, 255, 0, 200]);
    applyFilterToData(d, { grayscale: 1 });
    expect([d[3], d[7]]).toEqual([77, 200]);
    expect(d[0]).toBe(d[1]); expect(d[4]).toBe(d[5]);
  });
  it("applyPixelFilter memanggil getImageData/putImageData pada ctx", () => {
    const img = { data: px(255, 0, 0) };
    const calls = [];
    const ctx = { getImageData: (...a) => { calls.push(["get", ...a]); return img; }, putImageData: (i, x, y) => calls.push(["put", i === img, x, y]) };
    applyPixelFilter(ctx, 1, 1, { grayscale: 1 });
    expect(calls).toEqual([["get", 0, 0, 1, 1], ["put", true, 0, 0]]);
    expect(Array.from(img.data)).toEqual([54, 54, 54, 255]);
    calls.length = 0;
    applyPixelFilter(ctx, 1, 1, {});
    expect(calls).toEqual([]); // filter kosong: tidak menyentuh piksel
  });
});

describe("detectCtxFilter (uji piksel nyata)", () => {
  // canvas tiruan 1x1: menyimpan 1 piksel; drawImage menerapkan filter hanya bila `honor` true
  function fakeFactory({ honor, hasProp = true, throwOn }) {
    return () => {
      const px = [0, 0, 0, 0];
      const ctx = {
        fillRect() { const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(this.fillStyle); px.splice(0, 4, +m[1], +m[2], +m[3], 255); },
        drawImage(src) {
          const s = src.__px;
          if (throwOn === "draw") throw new Error("boom");
          if (honor && this.filter === "grayscale(1)") { const y = Math.round(0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2]); px.splice(0, 4, y, y, y, 255); }
          else px.splice(0, 4, ...s);
        },
        getImageData() { return { data: px.slice() }; },
      };
      if (hasProp) ctx.filter = "none";
      return { getContext: () => ctx, get __px() { return px; } };
    };
  }
  it("true bila filter benar-benar mengubah piksel", () => { expect(detectCtxFilter(fakeFactory({ honor: true }))).toBe(true); });
  it("false bila properti ada tapi diabaikan saat drawImage (quirk Safari)", () => { expect(detectCtxFilter(fakeFactory({ honor: false }))).toBe(false); });
  it("false bila properti filter tidak ada", () => { expect(detectCtxFilter(fakeFactory({ honor: true, hasProp: false }))).toBe(false); });
  it("false (tidak melempar) bila terjadi exception", () => { expect(detectCtxFilter(fakeFactory({ honor: true, throwOn: "draw" }))).toBe(false); });
  it("false bila getContext mengembalikan null", () => { expect(detectCtxFilter(() => ({ getContext: () => null }))).toBe(false); });
});

describe("seeded PRNG", () => {
  it("deterministik: seed sama -> urutan sama; seed beda -> beda", () => {
    const a = seeded(42), b = seeded(42), c = seeded(43);
    const sa = Array.from({ length: 10 }, a), sb = Array.from({ length: 10 }, b), sc = Array.from({ length: 10 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });
  it("nilai pertama seed 42 = 42*16807 mod (2^31-1) / (2^31-1) dan semua di (0,1)", () => {
    expect(seeded(42)()).toBe((42 * 16807 % 2147483647) / 2147483647);
    const r = seeded(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1); }
  });
  it("urutan stabil (golden 3 nilai pertama seed 42, dihitung independen dengan Python)", () => {
    const r = seeded(42);
    expect([r(), r(), r()]).toEqual([0.00032870750889587566, 0.5245871020129822, 0.7354235321913956]);
  });
});

describe("tanggal & nama file", () => {
  it("formatDate = 'DD . MM . YYYY' dengan nol di depan", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("05 . 01 . 2026");
    expect(formatDate(new Date(2026, 11, 31))).toBe("31 . 12 . 2026");
  });
  it("fileName = photobooth-YYYYMMDD-HHMMSS.png", () => {
    expect(fileName(new Date(2026, 9, 28, 7, 5, 9))).toBe("photobooth-20261028-070509.png");
    expect(fileName(new Date(2026, 0, 1, 23, 59, 59))).toBe("photobooth-20260101-235959.png");
    expect(fileName(new Date(2026, 3, 9, 14, 30, 0))).toMatch(/^photobooth-\d{8}-\d{6}\.png$/);
  });
});

describe("font fallback & fitFont", () => {
  it("fontStack menambah generic family", () => {
    expect(fontStack("Pacifico")).toBe('"Pacifico", cursive');
    expect(fontStack("Poppins")).toBe('"Poppins", system-ui, sans-serif');
    expect(fontStack("Courier Prime")).toBe('"Courier Prime", monospace');
    expect(fontStack("Tidak Dikenal")).toBe('"Tidak Dikenal", sans-serif');
  });
  it("fontSpec merangkai weight/size/family tanpa spasi ganda", () => {
    expect(fontSpec("", 56, "Courier Prime")).toBe('56px "Courier Prime", monospace');
    expect(fontSpec("600", 72, "Poppins")).toBe('600 72px "Poppins", system-ui, sans-serif');
  });
  // ctx tiruan: lebar = jumlah karakter * ukuran font * 0.5
  const fakeCtx = () => ({ font: "", measureText(t) { return { width: t.length * parseInt(/(\d+)px/.exec(this.font)[1], 10) * 0.5 }; } });
  it("teks pendek: ukuran awal dipakai", () => {
    const ctx = fakeCtx();
    expect(fitFont(ctx, "Hi", "Pacifico", 64, 508)).toBe(64);
    expect(ctx.font).toBe('64px "Pacifico", cursive');
  });
  it("teks panjang mengecil (langkah 2px) sampai muat", () => {
    const ctx = fakeCtx();
    const size = fitFont(ctx, "Best Friends Forever", "Pacifico", 64, 508);
    expect(size).toBeLessThan(64);
    expect(size % 2).toBe(0);
    expect(ctx.measureText("Best Friends Forever").width).toBeLessThanOrEqual(508);
    expect(ctx.measureText("Best Friends Forever").width + 20 * 0.5 * 2).toBeGreaterThan(508); // ukuran +2 tidak muat
    expect(ctx.font).toBe(`${size}px "Pacifico", cursive`);
  });
  it("batas bawah 18px benar-benar tercapai, weight dipakai", () => {
    const ctx = fakeCtx();
    const size = fitFont(ctx, "x".repeat(500), "Poppins", 56, 100, "600");
    expect(size).toBe(18);
    expect(ctx.font).toBe('600 18px "Poppins", system-ui, sans-serif');
  });
  it("ukuran awal ganjil tidak melewati batas bawah; ukuran awal < 18 dipaku ke 18", () => {
    expect(fitFont(fakeCtx(), "x".repeat(500), "Pacifico", 57, 100)).toBe(18);
    expect(fitFont(fakeCtx(), "x".repeat(500), "Pacifico", 10, 100)).toBe(18);
  });
  it("tepat muat di ukuran 18 -> berhenti di 18; muat di 20 -> tidak turun ke 18", () => {
    // lebar = len * size * 0.5 -> "x"*10: 18px = 90, 20px = 100
    expect(fitFont(fakeCtx(), "x".repeat(10), "Pacifico", 56, 90)).toBe(18);
    expect(fitFont(fakeCtx(), "x".repeat(10), "Pacifico", 56, 100)).toBe(20);
  });
});

describe("cameraErrorMessage (Bahasa Indonesia)", () => {
  it("pesan spesifik per jenis error", () => {
    expect(cameraErrorMessage({ name: "NotAllowedError" })).toMatch(/Izin kamera ditolak/);
    expect(cameraErrorMessage({ name: "NotFoundError" })).toMatch(/tidak ditemukan/);
    expect(cameraErrorMessage({ name: "NotReadableError" })).toMatch(/dipakai aplikasi lain/);
    expect(cameraErrorMessage({ name: "OverconstrainedError" })).toMatch(/tidak tersedia/);
  });
  it("tidak membocorkan pesan internal; nama error dipakai hanya untuk jenis tak dikenal", () => {
    const m = cameraErrorMessage({ name: "WeirdError", message: "secret internal path /x/y" });
    expect(m).toMatch(/WeirdError/);
    expect(m).not.toMatch(/secret/);
    expect(cameraErrorMessage(null)).toMatch(/tidak bisa diakses/);
  });
  it("konteks tidak aman -> instruksi https/localhost", () => {
    expect(cameraErrorMessage(null, { secure: false })).toMatch(/https:\/\/ atau http:\/\/localhost/);
  });
});

describe("needsRefilter (keputusan cache filter per slot)", () => {
  const entry = (filterId) => ({ filterId, canvas: {}, thumbUrl: null });
  it("belum ada cache (foto baru/reset) -> filter", () => {
    expect(needsRefilter(null, "normal")).toBe(true);
    expect(needsRefilter(undefined, "sepia")).toBe(true);
  });
  it("filter sama -> pakai cache; filter beda -> filter ulang", () => {
    expect(needsRefilter(entry("sepia"), "sepia")).toBe(false);
    expect(needsRefilter(entry("sepia"), "noir")).toBe(true);
  });
  it("simulasi: ketik teks/ganti frame tidak memfilter; ganti filter +4; retake 1 slot +1", () => {
    let runs = 0;
    const cache = new Array(4).fill(null);
    let filter = "normal";
    const get = (i) => { if (needsRefilter(cache[i], filter)) { runs++; cache[i] = entry(filter); } return cache[i]; };
    const renderAll = () => [0, 1, 2, 3].forEach(get);
    renderAll(); expect(runs).toBe(4);              // foto pertama kali
    renderAll(); renderAll(); expect(runs).toBe(4); // ketik teks / ganti frame / tanggal
    filter = "vintage"; renderAll(); expect(runs).toBe(8); // ganti filter
    cache[2] = null; renderAll(); expect(runs).toBe(9);    // retake slot 3
  });
});

describe("printLayout (cetak 2x6 vs 4x6)", () => {
  it("strip 2x6: 1 salinan, @page 2in x 6in, tanpa garis potong", () => {
    expect(printLayout("strip")).toEqual({ copies: 1, widthIn: 2, heightIn: 6, pageCss: "@page { size: 2in 6in; margin: 0; }", cutLine: false });
  });
  it("4x6: 2 salinan, @page 4in x 6in, dengan garis potong", () => {
    expect(printLayout("4x6")).toEqual({ copies: 2, widthIn: 4, heightIn: 6, pageCss: "@page { size: 4in 6in; margin: 0; }", cutLine: true });
  });
  it("mode tak dikenal jatuh ke 2x6 (aman)", () => {
    expect(printLayout("zzz").copies).toBe(1);
    expect(printLayout(undefined).cutLine).toBe(false);
  });
});
