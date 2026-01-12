# 📊 ÍNDICES COMPOSTOS DO FIRESTORE

## ⚠️ IMPORTANTE: CONFIGURAÇÃO OBRIGATÓRIA

Para que o **histórico de registros de ponto** funcione corretamente, você **PRECISA** criar um índice composto no Firestore.

---

## 🔍 POR QUE PRECISO DISSO?

O sistema faz uma query complexa que combina:
- **Filtro**: `where("employeeId", "==", identifiedEmployee.id)`
- **Ordenação**: `orderBy("timestamp", "desc")`

O Firestore **NÃO permite** queries com filtro + ordenação sem um índice composto.

---

## 🛠️ COMO CRIAR O ÍNDICE

### **Opção 1: Criar Manualmente no Console (RECOMENDADO)**

1. **Acesse o Firebase Console:**
   - URL: https://console.firebase.google.com/
   - Selecione seu projeto: `app-ponto-ed97f`

2. **Navegue até Firestore Database:**
   - Menu lateral → **Firestore Database**
   - Clique na aba **Indexes** (Índices)

3. **Crie um novo índice composto:**
   - Clique em **Create Index** (Criar Índice)
   - Preencha os campos:

   ```
   Collection ID: attendance
   
   Fields to index:
   1. Field path: employeeId
      Query scope: Collection
      Order: Ascending
   
   2. Field path: timestamp
      Query scope: Collection
      Order: Descending
   
   Query scope: Collection
   ```

4. **Aguarde a criação:**
   - O índice pode levar alguns minutos para ser criado
   - Status: Building → Enabled

---

### **Opção 2: Criar Automaticamente (Quando o Erro Aparecer)**

Se você **NÃO criar o índice manualmente**, o Firestore mostrará um erro no console com um **link direto** para criar o índice:

```
Error: The query requires an index. You can create it here: https://console.firebase.google.com/...
```

**Passos:**
1. Copie o link do erro no console do navegador
2. Cole no navegador
3. Clique em **Create Index**
4. Aguarde a criação

---

## 🎯 ÍNDICES NECESSÁRIOS PARA O SISTEMA

### **1. Índice para Histórico de Ponto (OBRIGATÓRIO)**

```
Collection: attendance
Fields:
  - employeeId (Ascending)
  - timestamp (Descending)
Query Scope: Collection
```

**Usado em:**
- Dashboard do funcionário → Histórico Recente
- Listener em tempo real de registros de ponto

---

### **2. Índice para Relatórios da Empresa (OPCIONAL - Futuro)**

```
Collection: attendance
Fields:
  - companyId (Ascending)
  - timestamp (Descending)
Query Scope: Collection
```

**Usado em:**
- Dashboard da empresa → Relatórios gerais
- Filtros por período

---

### **3. Índice para Relatórios por Local (OPCIONAL - Futuro)**

```
Collection: attendance
Fields:
  - locationId (Ascending)
  - timestamp (Descending)
Query Scope: Collection
```

**Usado em:**
- Dashboard da empresa → Relatórios por local
- Análise de frequência por ponto de serviço

---

## 🔧 VERIFICAR SE O ÍNDICE ESTÁ ATIVO

### **No Firebase Console:**
1. Acesse **Firestore Database** → **Indexes**
2. Procure pelo índice da collection `attendance`
3. Status deve estar **Enabled** (verde)

### **No Código (Console do Navegador):**
Após criar o índice, teste o sistema:
1. Faça login como funcionário
2. Registre um ponto
3. Verifique o console do navegador:
   - ✅ Se aparecer: `"📋 X registros de ponto carregados"` → **Índice funcionando!**
   - ❌ Se aparecer erro `"failed-precondition"` → **Índice ainda não está ativo**

---

## 🚨 ERROS COMUNS

### **Erro: "The query requires an index"**

**Causa:** Índice não foi criado ou ainda está sendo construído.

**Solução:**
1. Crie o índice manualmente (Opção 1 acima)
2. OU use o link do erro para criar automaticamente
3. Aguarde alguns minutos para o índice ficar ativo

---

### **Erro: "failed-precondition"**

**Causa:** Índice ainda está em construção (status: Building).

**Solução:**
- Aguarde alguns minutos
- Recarregue a página
- Verifique o status no Firebase Console

---

### **Erro: "permission-denied"**

**Causa:** Regras do Firestore estão bloqueando a leitura.

**Solução:**
- Verifique o arquivo `firestore.rules`
- A collection `attendance` deve ter `allow read: if true;`

---

## 📝 REGRAS DO FIRESTORE (VERIFICAR)

Certifique-se de que as regras estão corretas:

```javascript
match /attendance/{attendanceId} {
  // LEITURA: Qualquer pessoa pode ler (para o histórico)
  allow read: if true;

  // CRIAÇÃO: Apenas registros válidos do app de ponto
  allow create: if request.resource.data.verified == true
                && request.resource.data.employeeId is string
                && request.resource.data.type in ['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'];

  // ATUALIZAÇÃO: Apenas usuários autenticados (admins)
  allow update: if request.auth != null;

  // EXCLUSÃO: Apenas admins, ou para limpar documentos de teste
  allow delete: if request.auth != null || (resource.data.isTest == true);
}
```

---

## ✅ CHECKLIST DE CONFIGURAÇÃO

- [ ] Índice composto criado no Firebase Console
- [ ] Status do índice: **Enabled** (verde)
- [ ] Regras do Firestore configuradas corretamente
- [ ] Teste realizado: Registro de ponto → Histórico atualiza
- [ ] Console do navegador sem erros de índice

---

## 🆘 SUPORTE

Se o histórico ainda não atualizar após criar o índice:

1. **Verifique os logs no console do navegador:**
   - Procure por mensagens começando com `🎧 CONFIGURANDO LISTENER`
   - Procure por `🔔 LISTENER ACIONADO!`
   - Procure por erros em vermelho

2. **Verifique o Firebase Console:**
   - Vá em **Firestore Database** → **Data**
   - Abra a collection `attendance`
   - Confirme que os documentos estão sendo salvos

3. **Teste o refresh manual:**
   - Após registrar o ponto, recarregue a página
   - O histórico deve aparecer

---

## 📚 DOCUMENTAÇÃO OFICIAL

- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Composite Indexes](https://firebase.google.com/docs/firestore/query-data/index-overview#composite_indexes)
- [Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

**Última atualização:** 11/01/2026
**Versão do sistema:** 2.0
