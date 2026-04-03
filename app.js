import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

const els = {
  messages: document.getElementById("messages"),
  input: document.getElementById("promptInput"),
  sendBtn: document.getElementById("sendBtn"),
  clearBtn: document.getElementById("clearBtn"),
  loadModelBtn: document.getElementById("loadModelBtn"),
  modelSelect: document.getElementById("modelSelect"),
  statusText: document.getElementById("statusText"),
  led: document.getElementById("led"),
  mouth: document.getElementById("mouth"),
  progressText: document.getElementById("progressText"),
  installBtn: document.getElementById("installBtn")
};

const MODEL_APP_CONFIG = {
  cacheBackend: "cache",
  model_list: [
    {
      model: "https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC",
      model_id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm"
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q0f16-MLC",
      model_id: "SmolLM2-360M-Instruct-q0f16-MLC",
      model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/SmolLM2-360M-Instruct-q0f16-ctx4k_cs1k-webgpu.wasm"
    },
    {
      model: "https://huggingface.co/mlc-ai/SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      model_id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/SmolLM2-1.7B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm"
    }
  ]
};

let engine = null;
let chatHistory = JSON.parse(localStorage.getItem("gideon-mobile-history") || "[]");
let isBusy = false;
let mouthTimer = null;
let deferredPrompt = null;

function setStatus(text, mode = "online") {
  els.statusText.textContent = text;
  const styles = {
    online: ["#00ff88", "#00ff88"],
    busy: ["#ffcc00", "#ffcc00"],
    error: ["#ff6b6b", "#ff6b6b"]
  };
  const [bg, glow] = styles[mode] || styles.online;
  els.led.style.background = bg;
  els.led.style.boxShadow = `0 0 10px ${glow}`;
}

function setProgress(text) { els.progressText.textContent = text; }

function animateMouth(start) {
  if (start) {
    stopMouth();
    let open = false;
    mouthTimer = setInterval(() => {
      els.mouth.style.height = open ? "8px" : "18px";
      els.mouth.style.width = open ? "44px" : "38px";
      open = !open;
    }, 120);
  } else {
    stopMouth();
    els.mouth.style.height = "8px";
    els.mouth.style.width = "44px";
  }
}

function stopMouth() {
  if (mouthTimer) {
    clearInterval(mouthTimer);
    mouthTimer = null;
  }
}

function addMessage(text, sender = "bot") {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${sender}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = sender === "user" ? "👤" : "G";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  els.messages.appendChild(wrapper);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderHistory() {
  els.messages.innerHTML = "";
  if (!chatHistory.length) {
    addMessage("Olá. Sou o GIDEON mobile offline. Escolha um modelo leve e toque em ‘Baixar / Carregar modelo’.", "bot");
    return;
  }
  for (const item of chatHistory) addMessage(item.content, item.role === "user" ? "user" : "bot");
}

function saveHistory() {
  localStorage.setItem("gideon-mobile-history", JSON.stringify(chatHistory.slice(-20)));
}

async function checkWebGPUSupport() {
  if (!('gpu' in navigator)) {
    setStatus('Sem WebGPU', 'error');
    setProgress('Seu navegador não expõe navigator.gpu. Atualize o Chrome.');
    addMessage('Seu navegador não suporta WebGPU. No Android, use o Chrome atualizado.', 'bot');
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      setStatus('Sem adaptador WebGPU', 'error');
      setProgress('O navegador abriu, mas não conseguiu um adaptador GPU.');
      addMessage('Não consegui acessar a GPU pelo navegador.', 'bot');
      return false;
    }
    return true;
  } catch (err) {
    setStatus('Erro WebGPU', 'error');
    setProgress('Falha ao inicializar WebGPU.');
    addMessage(`Erro ao iniciar WebGPU: ${String(err.message || err)}`, 'bot');
    return false;
  }
}

async function loadModel() {
  if (isBusy) return;
  const supported = await checkWebGPUSupport();
  if (!supported) return;
  isBusy = true;
  els.loadModelBtn.disabled = true;
  els.sendBtn.disabled = true;

  try {
    setStatus("Carregando modelo...", "busy");
    animateMouth(true);
    const selectedModel = els.modelSelect.value;

    engine = await CreateMLCEngine(selectedModel, {
      appConfig: MODEL_APP_CONFIG,
      initProgressCallback: (report) => {
        const pct = report.progress ? Math.round(report.progress * 100) : 0;
        const text = report.text || 'Preparando';
        setStatus(`Carregando ${pct}%`, "busy");
        setProgress(`${text} (${pct}%)`);
      },
      logLevel: "INFO"
    });

    setStatus("Modelo pronto offline", "online");
    setProgress("Modelo carregado. Agora abra algumas vezes e depois teste sem internet.");
    addMessage(`Modelo carregado: ${selectedModel}`, "bot");
    els.sendBtn.disabled = false;
  } catch (err) {
    console.error(err);
    setStatus("Falha ao carregar modelo", "error");
    setProgress("O modelo falhou. Tente primeiro o SmolLM2 360M, depois o Llama 3.2 1B.");
    addMessage(`Não consegui carregar o modelo. Tente outro da lista. Detalhe: ${String(err.message || err)}`, "bot");
  } finally {
    animateMouth(false);
    isBusy = false;
    els.loadModelBtn.disabled = false;
  }
}

async function askModel(prompt) {
  if (!engine) {
    addMessage("Primeiro toque em ‘Baixar / Carregar modelo’.", "bot");
    return;
  }
  if (isBusy) return;
  isBusy = true;
  els.sendBtn.disabled = true;

  try {
    chatHistory.push({ role: "user", content: prompt });
    saveHistory();
    addMessage(prompt, "user");
    setStatus("Pensando...", "busy");
    setProgress("Gerando resposta localmente no celular...");
    animateMouth(true);

    const messages = [
      {
        role: "system",
        content: "Você é GIDEON, um assistente útil em português do Brasil. Responda com clareza. Se não souber, admita. Não invente fatos específicos. Seja objetivo."
      },
      ...chatHistory.slice(-10)
    ];

    const reply = await engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 220
    });

    const answer = reply.choices?.[0]?.message?.content?.trim() || "Não consegui responder agora.";
    chatHistory.push({ role: "assistant", content: answer });
    saveHistory();
    addMessage(answer, "bot");
    setStatus("Modelo pronto offline", "online");
    setProgress("Resposta gerada localmente. Offline pronto após o primeiro download completo.");
  } catch (err) {
    console.error(err);
    setStatus("Erro na resposta", "error");
    setProgress("O modelo abriu, mas falhou ao responder. Tente limpar a conversa ou usar o modelo menor.");
    addMessage(`Deu erro ao gerar resposta: ${String(err.message || err)}`, "bot");
  } finally {
    animateMouth(false);
    isBusy = false;
    els.sendBtn.disabled = false;
  }
}

els.loadModelBtn.addEventListener("click", loadModel);
els.sendBtn.addEventListener("click", async () => {
  const prompt = els.input.value.trim();
  if (!prompt) return;
  els.input.value = "";
  await askModel(prompt);
});
els.clearBtn.addEventListener("click", () => {
  chatHistory = [];
  saveHistory();
  renderHistory();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.hidden = false;
});

els.installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try { await navigator.serviceWorker.register("./sw.js"); } catch (e) { console.error("SW error", e); }
  });
}

renderHistory();
els.sendBtn.disabled = true;
setStatus("Pronto para carregar modelo", "online");
setProgress("No Redmi Note 13, tente primeiro SmolLM2 360M se o Llama 3.2 falhar.");
