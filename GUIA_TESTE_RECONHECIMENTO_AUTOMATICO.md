# 🧪 GUIA DE TESTE - RECONHECIMENTO AUTOMÁTICO

## 🎯 OBJETIVO
Testar o sistema de reconhecimento facial automático (sem botões) para login e registro de ponto.

---

## ⚙️ PRÉ-REQUISITOS

1. ✅ Sistema rodando em `localhost` ou `HTTPS`
2. ✅ Câmera funcionando e com permissão concedida
3. ✅ Modelos face-api.js em `/public/models/`
4. ✅ Pelo menos 1 funcionário cadastrado com foto

---

## 📋 CENÁRIOS DE TESTE

### **TESTE 1: Login Automático - Sucesso** ✅

**Objetivo:** Verificar se o sistema reconhece e faz login automaticamente

**Passos:**
1. Acesse o sistema
2. Faça login como ADMIN
3. Cadastre um funcionário com foto (tire uma selfie)
4. Faça logout
5. Acesse novamente como FUNCIONÁRIO
6. Selecione a empresa e local de trabalho
7. Clique em "INICIAR CÂMERA"
8. Posicione seu rosto na câmera
9. **Aguarde 2-4 segundos**

**Resultado Esperado:**
- ✅ Mensagem: "🔍 Reconhecendo automaticamente..."
- ✅ Após 2-4s: "✅ Funcionário identificado!"
- ✅ Login automático → Dashboard desbloqueado
- ✅ Sem necessidade de clicar em botão

**Console (F12):**
```
📷 Iniciando câmera para login facial...
✅ Câmera frontal acessada
🤖 Iniciando reconhecimento facial AUTOMÁTICO...
🔍 Identificando funcionário...
✅ Rosto detectado (confiança: 0.987)
✅ Funcionário identificado: JOÃO SILVA
```

---

### **TESTE 2: Login Automático - Rosto Não Cadastrado** ❌

**Objetivo:** Verificar se o sistema rejeita rostos não cadastrados

**Passos:**
1. Acesse o sistema como FUNCIONÁRIO
2. Clique em "INICIAR CÂMERA"
3. Posicione um rosto **não cadastrado** na câmera
4. **Aguarde 10 segundos**

**Resultado Esperado:**
- ⚠️ Mensagem: "⚠️ Rosto não reconhecido!"
- ❌ NÃO faz login
- ❌ Permanece na tela de login

**Console (F12):**
```
🔍 Identificando funcionário...
✅ Rosto detectado (confiança: 0.982)
⚠️ Nenhum funcionário correspondente encontrado
```

---

### **TESTE 3: Registro de Ponto Automático - Sucesso** ✅

**Objetivo:** Verificar se o sistema registra ponto automaticamente

**Passos:**
1. Faça login como funcionário (reconhecimento facial)
2. No dashboard, clique em **"ENTRADA"**
3. Aguarde verificação de localização
4. Posicione seu rosto na câmera
5. **Aguarde 2-4 segundos**

**Resultado Esperado:**
- ✅ Mensagem: "Verificando sua localização..."
- ✅ Mensagem: "✅ Localização verificada"
- ✅ Mensagem: "🔍 Verificando identidade..."
- ✅ Mensagem: "✅ Identidade confirmada! Registrando..."
- ✅ Ponto registrado automaticamente
- ✅ Modal fecha e histórico atualiza
- ✅ Sem necessidade de clicar em botão

**Console (F12):**
```
📍 Verificando localização...
✅ Dentro do raio permitido
🤖 AUTO-RECONHECIMENTO: Iniciando validação de identidade...
✅ Rosto detectado no vídeo (confiança: 0.989)
🔐 Validando se é o mesmo funcionário logado: JOÃO SILVA
📊 Distância euclidiana: 0.3245 (threshold: 0.55)
✅ SEGURANÇA: Identidade confirmada! É o mesmo funcionário.
💾 Registrando ponto automaticamente...
✅ Ponto registrado com sucesso!
```

---

### **TESTE 4: Registro de Ponto - Pessoa Diferente (SEGURANÇA)** 🔐❌

**Objetivo:** Verificar se o sistema bloqueia registro de outra pessoa

**Passos:**
1. Faça login como **Funcionário A**
2. Clique em **"ENTRADA"**
3. Aguarde verificação de localização
4. Posicione o rosto do **Funcionário B** na câmera
5. **Aguarde 2-4 segundos**

**Resultado Esperado:**
- ❌ Mensagem: "⚠️ Rosto não reconhecido!"
- ❌ Alerta: "❌ ERRO DE SEGURANÇA - O rosto detectado não corresponde ao funcionário logado"
- ❌ Ponto NÃO é registrado
- ❌ Modal permanece aberto

**Console (F12):**
```
🤖 AUTO-RECONHECIMENTO: Iniciando validação de identidade...
✅ Rosto detectado no vídeo (confiança: 0.991)
🔐 Validando se é o mesmo funcionário logado: JOÃO SILVA
📊 Distância euclidiana: 0.7823 (threshold: 0.55)
❌ SEGURANÇA: Rosto detectado NÃO corresponde ao funcionário logado!
```

---

### **TESTE 5: Registro de Ponto - Sem Rosto Detectado** ⚠️

**Objetivo:** Verificar comportamento quando não detecta rosto

**Passos:**
1. Faça login como funcionário
2. Clique em **"ENTRADA"**
3. Aguarde verificação de localização
4. **NÃO posicione o rosto** na câmera (vire para o lado)
5. **Aguarde 10 segundos**

**Resultado Esperado:**
- ⚠️ Mensagem: "👤 Posicione seu rosto..."
- ⚠️ Sistema continua tentando reconhecer
- ❌ Ponto NÃO é registrado

**Console (F12):**
```
🤖 AUTO-RECONHECIMENTO: Iniciando validação de identidade...
⚠️ Nenhum rosto detectado no vídeo
```

---

### **TESTE 6: Cancelar Reconhecimento** ❌

**Objetivo:** Verificar se o botão "CANCELAR" funciona

**Passos:**
1. Inicie o reconhecimento (login ou registro de ponto)
2. Clique em **"CANCELAR"**

**Resultado Esperado:**
- ✅ Câmera desliga
- ✅ Modal fecha
- ✅ Reconhecimento automático para
- ✅ Volta para tela anterior

**Console (F12):**
```
🛑 Parando reconhecimento automático...
🔌 Desligando câmera...
```

---

### **TESTE 7: Múltiplos Tipos de Ponto** 🕐

**Objetivo:** Testar todos os tipos de registro

**Passos:**
1. Faça login como funcionário
2. Teste cada tipo de ponto:
   - **ENTRADA** → Deve registrar automaticamente
   - **INÍCIO PAUSA** → Deve registrar automaticamente
   - **FIM PAUSA** → Deve registrar automaticamente
   - **SAÍDA** → Deve registrar automaticamente

**Resultado Esperado:**
- ✅ Todos os tipos devem funcionar com reconhecimento automático
- ✅ Histórico deve mostrar todos os registros
- ✅ Cada registro deve ter timestamp correto

---

## 🔍 VERIFICAÇÕES NO CONSOLE

Abra o console do navegador (F12) e procure por:

### **Logs de Sucesso (✅):**
```
✅ Câmera frontal acessada
✅ Câmera pronta para identificação
🤖 Iniciando reconhecimento facial AUTOMÁTICO...
✅ Rosto detectado (confiança: 0.XXX)
✅ Funcionário identificado: NOME
✅ SEGURANÇA: Identidade confirmada!
✅ Ponto registrado com sucesso!
```

### **Logs de Erro (❌):**
```
❌ Erro ao acessar câmera
⚠️ Nenhum rosto detectado
⚠️ Nenhum funcionário correspondente encontrado
❌ SEGURANÇA: Rosto detectado NÃO corresponde ao funcionário logado!
```

---

## ⚙️ AJUSTES DE PERFORMANCE

### **Se o reconhecimento estiver MUITO LENTO:**

Edite `components/Dashboard.tsx` e reduza o intervalo:

```typescript
// Linha ~270 (Login)
recognitionInterval = setInterval(() => {
  identifyEmployee();
}, 1000); // Mudou de 2000ms para 1000ms (1 segundo)

// Linha ~290 (Registro de Ponto)
attendanceRecognitionInterval = setInterval(() => {
  autoRecognizeAndRegister();
}, 1000); // Mudou de 2000ms para 1000ms (1 segundo)
```

### **Se houver MUITOS FALSOS POSITIVOS:**

Edite `components/Dashboard.tsx` e reduza o threshold:

```typescript
// Linha ~1050 (Login)
const RECOGNITION_THRESHOLD = 0.50; // Mudou de 0.55 para 0.50 (mais restritivo)

// Linha ~1180 (Registro de Ponto)
const SECURITY_THRESHOLD = 0.50; // Mudou de 0.55 para 0.50 (mais restritivo)
```

### **Se NÃO RECONHECER mesmo com rosto correto:**

Edite `components/Dashboard.tsx` e aumente o threshold:

```typescript
// Linha ~1050 (Login)
const RECOGNITION_THRESHOLD = 0.60; // Mudou de 0.55 para 0.60 (menos restritivo)

// Linha ~1180 (Registro de Ponto)
const SECURITY_THRESHOLD = 0.60; // Mudou de 0.55 para 0.60 (menos restritivo)
```

---

## 📊 TABELA DE RESULTADOS

Use esta tabela para documentar seus testes:

| Teste | Cenário | Resultado | Observações |
|-------|---------|-----------|-------------|
| 1 | Login automático - sucesso | ✅ / ❌ | |
| 2 | Login - rosto não cadastrado | ✅ / ❌ | |
| 3 | Registro de ponto - sucesso | ✅ / ❌ | |
| 4 | Registro - pessoa diferente | ✅ / ❌ | |
| 5 | Registro - sem rosto | ✅ / ❌ | |
| 6 | Cancelar reconhecimento | ✅ / ❌ | |
| 7 | Múltiplos tipos de ponto | ✅ / ❌ | |

---

## 🐛 PROBLEMAS COMUNS

### **Problema 1: Câmera não inicia**
**Solução:**
- Verifique permissões do navegador
- Acesse via HTTPS ou localhost
- Teste em outro navegador

### **Problema 2: Reconhecimento não inicia automaticamente**
**Solução:**
- Verifique se os modelos estão carregados (console)
- Aguarde 2-3 segundos após câmera abrir
- Verifique se `modelsLoaded` está `true`

### **Problema 3: Sempre mostra "Rosto não reconhecido"**
**Solução:**
- Verifique se o funcionário tem foto cadastrada
- Aumente o threshold (0.60 ou 0.65)
- Melhore a iluminação do ambiente

### **Problema 4: Registra ponto de outra pessoa**
**Solução:**
- Reduza o threshold de segurança (0.50 ou 0.45)
- Verifique se a foto cadastrada é de boa qualidade

---

## ✅ CHECKLIST FINAL

Antes de considerar o teste completo, verifique:

- [ ] Login automático funciona
- [ ] Registro de ponto automático funciona
- [ ] Validação de segurança bloqueia pessoa diferente
- [ ] Mensagens de erro são claras
- [ ] Console mostra logs detalhados
- [ ] Botão "CANCELAR" funciona
- [ ] Histórico de pontos atualiza corretamente
- [ ] Performance é aceitável (2-4 segundos)

---

## 📞 SUPORTE

Se todos os testes falharem:
1. Verifique se os modelos face-api.js estão em `/public/models/`
2. Limpe o cache do navegador (Ctrl+Shift+Delete)
3. Teste em modo anônimo/privado
4. Verifique o console para erros de JavaScript

---

**Data:** 11 de janeiro de 2026  
**Versão:** 1.0  
**Status:** Pronto para teste
