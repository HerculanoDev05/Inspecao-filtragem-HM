// =====================================================
// INSPEÇÃO FILTRAGEM - HerculanoForms
// Com persistência de dados em caso de falha do envio do formulario
// =====================================================

const WEBHOOK_CONFIG = {
  //url: 'https://n8n.grupoherculano.tech/webhook-test/formulario-filtragem',

  url:'https://n8n.grupoherculano.tech/webhook/formulario-filtragem',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

// =====================================================
// MÓDULO DE PERSISTÊNCIA
// =====================================================
const FormPersistence = {
  STORAGE_KEY: 'filtragem_pending',
  MAX_RETRIES: 3,
  RETRY_DELAYS: [2000, 5000, 10000],

  saveLocal(dados) {
    const pending = this.getPending();
    const entry = {
      id: Date.now(),
      dados,
      tentativas: 0,
      criadoEm: new Date().toISOString(),
      status: 'pendente'
    };
    pending.push(entry);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pending));
    console.log(`[Cache] Dados salvos. ID: ${entry.id}`);
    return entry.id;
  },

  getPending() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('[Cache] Erro ao ler:', e);
      return [];
    }
  },

  updateStatus(id, status, tentativas = null) {
    const pending = this.getPending();
    const index = pending.findIndex(p => p.id === id);
    if (index !== -1) {
      pending[index].status = status;
      pending[index].ultimaTentativa = new Date().toISOString();
      if (tentativas !== null) pending[index].tentativas = tentativas;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pending));
    }
  },

  removeLocal(id) {
    const pending = this.getPending().filter(p => p.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pending));
    console.log(`[Cache] ID ${id} removido após sucesso.`);
  },

  getContagemPendentes() { return this.getPending().length; },
  temPendentes() { return this.getPending().length > 0; },
  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); },

  async enviarComRetry(dados, id = null) {
    if (!id) id = this.saveLocal(dados);
    this.updateStatus(id, 'enviando');

    for (let tentativa = 0; tentativa < this.MAX_RETRIES; tentativa++) {
      try {
        console.log(`[Envio] Tentativa ${tentativa + 1}/${this.MAX_RETRIES}`);
        const response = await fetch(WEBHOOK_CONFIG.url, {
          method: WEBHOOK_CONFIG.method,
          headers: WEBHOOK_CONFIG.headers,
          body: JSON.stringify(dados)
        });

        if (response.ok) {
          this.removeLocal(id);
          return { success: true, id };
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn(`[Envio] Tentativa ${tentativa + 1} falhou:`, error.message);
        this.updateStatus(id, 'erro', tentativa + 1);
        if (tentativa < this.MAX_RETRIES - 1) {
          await this.sleep(this.RETRY_DELAYS[tentativa] || 5000);
        }
      }
    }

    this.updateStatus(id, 'erro', this.MAX_RETRIES);
    return { success: false, id, savedLocally: true };
  },

  async processarPendentes() {
    const pending = this.getPending();
    if (pending.length === 0) return { total: 0, enviados: 0, falhas: 0 };

    console.log(`[Fila] Processando ${pending.length} pendente(s)...`);
    let enviados = 0, falhas = 0;

    for (const entry of pending) {
      if (entry.status === 'enviando') continue;
      const result = await this.enviarComRetry(entry.dados, entry.id);
      result.success ? enviados++ : falhas++;
      await this.sleep(500);
    }

    return { total: pending.length, enviados, falhas };
  }
};

// =====================================================
// INICIALIZAÇÃO
// =====================================================
document.addEventListener('DOMContentLoaded', function () {

  // Radio buttons: seleção visual + campos condicionais + required dinâmico
  document.querySelectorAll('.radio-option input[type="radio"]').forEach((radio) => {
    radio.addEventListener('change', function () {
      const name = this.name;

      // Seleção visual
      document.querySelectorAll(`input[name="${name}"]`).forEach((r) => {
        r.closest('.radio-option').classList.remove('selected');
      });
      this.closest('.radio-option').classList.add('selected');

      // Campos condicionais com required dinâmico
      if (this.hasAttribute('data-toggle')) {
        const toggleId = this.getAttribute('data-toggle');
        const conditionalField = document.getElementById(toggleId);
        const isPendente = (
          this.value === 'Pendente' ||
          this.value.includes('inadequada') ||
          this.value.includes('inaceitável')
        );

        if (isPendente) {
          // Mostra e torna os textareas obrigatórios
          conditionalField.classList.add('show');
          conditionalField.querySelectorAll('textarea').forEach(t => {
            t.required = true;
          });
        } else {
          // Esconde, remove obrigatório e limpa valores
          conditionalField.classList.remove('show');
          conditionalField.querySelectorAll('textarea').forEach(t => {
            t.required = false;
            t.value = '';
          });
        }
      }

      // Salva no localStorage
      localStorage.setItem(`filtragem_campo_${name}`, this.value);
      atualizarIndicadorRascunho();
    });
  });

  // Salvar selects e textareas automaticamente
  document.querySelectorAll('select, textarea').forEach((field) => {
    field.addEventListener('change', () => {
      localStorage.setItem(`filtragem_campo_${field.name}`, field.value);
      atualizarIndicadorRascunho();
    });
  });

  carregarRascunho();
  criarIndicadorRascunho();
  criarIndicadorPendentes();

  if (FormPersistence.temPendentes()) {
    const count = FormPersistence.getContagemPendentes();
    showToast(`⚠ ${count} envio(s) pendente(s) encontrado(s).`, 'error');
  }
});

// =====================================================
// RASCUNHO
// =====================================================
function carregarRascunho() {
  document.querySelectorAll('input[type="radio"], select, textarea').forEach((field) => {
    const saved = localStorage.getItem(`filtragem_campo_${field.name}`);
    if (!saved) return;

    if (field.type === 'radio') {
      if (field.value === saved) {
        field.checked = true;
        field.dispatchEvent(new Event('change'));
      }
    } else {
      field.value = saved;
    }
  });
}

function limparRascunho() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('filtragem_campo_'))
    .forEach(k => localStorage.removeItem(k));
  atualizarIndicadorRascunho();
  console.log('[Rascunho] Limpo após envio com sucesso.');
}

function criarIndicadorRascunho() {
  const indicator = document.createElement('div');
  indicator.id = 'rascunho-indicator';
  indicator.textContent = '💾 Rascunho salvo';
  indicator.style.cssText = `
    position: fixed; bottom: 80px; right: 20px;
    background: #f0f4ff; color: #1e3c72;
    border: 1px solid #1e3c72; padding: 8px 16px;
    border-radius: 8px; font-size: 13px;
    font-weight: 500; display: none; z-index: 999;
  `;
  document.body.appendChild(indicator);
  atualizarIndicadorRascunho();
}

function atualizarIndicadorRascunho() {
  const indicator = document.getElementById('rascunho-indicator');
  if (!indicator) return;
  const temDados = Object.keys(localStorage).some(k => k.startsWith('filtragem_campo_'));
  indicator.style.display = temDados ? 'block' : 'none';
}

// =====================================================
// INDICADOR DE PENDENTES
// =====================================================
function criarIndicadorPendentes() {
  const indicator = document.createElement('div');
  indicator.id = 'pending-indicator';
  indicator.innerHTML = `
    <span>⏳</span>
    <span class="pending-count">0</span>
    <span>pendente(s)</span>
    <button type="button" onclick="reenviarPendentes()" class="btn-resend">Reenviar</button>
  `;
  indicator.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    background: #ee5a5a; color: white;
    padding: 12px 20px; border-radius: 12px;
    display: none; align-items: center;
    gap: 10px; z-index: 1000; font-family: inherit;
  `;

  const style = document.createElement('style');
  style.textContent = `
    #pending-indicator .pending-count {
      background: white; color: #ee5a5a;
      padding: 2px 10px; border-radius: 20px;
      font-weight: bold; font-size: 14px;
    }
    #pending-indicator .btn-resend {
      background: white; color: #ee5a5a; border: none;
      padding: 8px 16px; border-radius: 6px;
      cursor: pointer; font-weight: 600; font-size: 13px;
    }
    #pending-indicator .btn-resend:hover { opacity: 0.85; }
    #pending-indicator .btn-resend:disabled { opacity: 0.6; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(indicator);
  atualizarIndicadorPendentes();
}

function atualizarIndicadorPendentes() {
  const indicator = document.getElementById('pending-indicator');
  const count = FormPersistence.getContagemPendentes();
  if (indicator) {
    indicator.style.display = count > 0 ? 'flex' : 'none';
    const countEl = indicator.querySelector('.pending-count');
    if (countEl) countEl.textContent = count;
  }
}

async function reenviarPendentes() {
  const btn = document.querySelector('.btn-resend');
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  const result = await FormPersistence.processarPendentes();

  btn.disabled = false;
  btn.textContent = 'Reenviar';
  atualizarIndicadorPendentes();

  if (result.enviados > 0) showToast(`✓ ${result.enviados} registro(s) enviado(s)!`, 'success');
  if (result.falhas > 0) showToast(`✗ ${result.falhas} ainda pendente(s).`, 'error');
}

// =====================================================
// TOAST
// =====================================================
function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    const style = document.createElement('style');
    style.textContent = `
      #toast {
        position: fixed; top: 20px; left: 50%;
        transform: translateX(-50%) translateY(-80px);
        padding: 14px 28px; border-radius: 10px;
        font-size: 15px; font-weight: 500;
        z-index: 9999; transition: transform 0.3s ease;
        max-width: 90vw; text-align: center;
      }
      #toast.show { transform: translateX(-50%) translateY(0); }
      #toast.success { background: #1e3c72; color: white; }
      #toast.error { background: #ee5a5a; color: white; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 5000);
}

// =====================================================
// COLETA DE DADOS
// =====================================================
function collectFormData() {
  const formData = new FormData(document.getElementById('inspectionForm'));
  const data = {};
  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }
  data.timestamp_envio = new Date().toISOString();
  data.formulario = 'Inspeção Filtragem';
  return data;
}

// =====================================================
// SUBMIT
// =====================================================
document.getElementById('inspectionForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const submitBtn = this.querySelector('[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  const data = collectFormData();
  console.log('[Form] Dados coletados:', data);

  const result = await FormPersistence.enviarComRetry(data);

  submitBtn.disabled = false;
  submitBtn.textContent = originalText;
  atualizarIndicadorPendentes();

  if (result.success) {
    limparRascunho();
    showToast('✓ Formulário enviado com sucesso!', 'success');
    this.reset();
    // Limpa visual e required dos campos condicionais
    document.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
    document.querySelectorAll('.conditional-field').forEach(f => {
      f.classList.remove('show');
      f.querySelectorAll('textarea').forEach(t => {
        t.required = false;
        t.value = '';
      });
    });
  } else if (result.savedLocally) {
    showToast('⚠ Sem conexão. Dados salvos para envio posterior.', 'error');
  } else {
    showToast('✗ Erro ao enviar. Tente novamente.', 'error');
  }
});

// =====================================================
// EVENTOS DE CONEXÃO
// =====================================================
window.addEventListener('online', async () => {
  showToast('🌐 Conexão restabelecida!', 'success');
  await FormPersistence.sleep(2000);

  if (FormPersistence.temPendentes()) {
    showToast('⏳ Enviando dados pendentes...', 'success');
    const result = await FormPersistence.processarPendentes();
    atualizarIndicadorPendentes();
    if (result.enviados > 0) {
      limparRascunho();
      showToast(`✓ ${result.enviados} pendente(s) enviado(s)!`, 'success');
    }
  }
});

window.addEventListener('offline', () => {
  showToast('⚠ Sem conexão. Dados serão salvos localmente.', 'error');
});

// =====================================================
// ARQUIVO - PREVIEW DO NOME
// =====================================================
function showFileName(input, previewId) {
  const preview = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    preview.textContent = `📎 ${input.files[0].name}`;
  } else {
    preview.textContent = '';
  }
}