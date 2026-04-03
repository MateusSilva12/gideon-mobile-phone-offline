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
  mouth: document.getElementById("mouth")
};

let engine = null;
let chatHistory = JSON.parse(localStorage.getItem("gideon-mobile-history") || "[]");
let isBusy = false;
let mouthTimer = null;

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
    addMessage("Olá. Sou o GIDEON mobile offline. Carregue um modelo e pergunte o que quiser.", "bot");
    return;
  }

  for (const item of chatHistory) {
    addMessage(item.content, item.role === "user" ? "user" : "bot");
  }
}

function saveHistory() {
  localStorage.setItem("gideon-mobile-history", JSON.stringify(chatHistory.slice(-20)));
}

async function loadModel() {
  if (isBusy) return;
  isBusy = true;

  try {
    setStatus("Carregando modelo...", "busy");
    animateMouth(true);

    const selectedModel = els.modelSelect.value;

    engine = await CreateMLCEngine(selectedModel, {
      initProgressCallback: (report) => {
        const pct = report.progress ? Math.round(report.progress * 100) : 0;
        setStatus(`Baixando/carregando modelo... ${pct}%`, "busy");
      }
    });

    setStatus("Modelo pronto offline", "online");
    addMessage(`Modelo carregado: ${selectedModel}`, "bot");
  } catch (err) {
    console.error(err);
    setStatus("Falha ao carregar modelo", "error");
    addMessage("Não consegui carregar o modelo. Verifique se o navegador suporta WebGPU e tente novamente.", "bot");
  } finally {
    animateMouth(false);
    isBusy = false;
  }
}

async function askModel(prompt) {
  if (!engine) {
    addMessage("Primeiro toque em “Baixar / Carregar modelo”.", "bot");
    return;
  }

  if (isBusy) return;
  isBusy = true;

  try {
    chatHistory.push({ role: "user", content: prompt });
    saveHistory();
    addMessage(prompt, "user");

    setStatus("Pensando...", "busy");
    animateMouth(true);

    const messages = [
      {
        role: "system",
        content:
          "Você é GIDEON, um assistente útil em português do Brasil. Responda com clareza. Se não souber, admita. Não invente fatos específicos."
      },
      ...chatHistory.slice(-12)
    ];

    const reply = await engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 300
    });

    const answer = reply.choices?.[0]?.message?.content?.trim() || "Não consegui responder agora.";

    chatHistory.push({ role: "assistant", content: answer });
    saveHistory();
    addMessage(answer, "bot");
    setStatus("Modelo pronto offline", "online");
  } catch (err) {
    console.error(err);
    setStatus("Erro na resposta", "error");
    addMessage("Deu erro ao gerar resposta no aparelho.", "bot");
  } finally {
    animateMouth(false);
    isBusy = false;
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (e) {
      console.error("SW error", e);
    }
  });
}

renderHistory();
setStatus("Pronto para carregar modelo", "online");
