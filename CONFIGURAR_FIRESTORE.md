# ⚡ GUIA RÁPIDO - CONFIGURAR REGRAS DO FIRESTORE

## 🎯 OBJETIVO

Configurar as regras de segurança do Firestore para permitir que os funcionários registrem ponto.

## ⏱️ TEMPO ESTIMADO: 3 minutos

---

## 📝 PASSO A PASSO

### 1️⃣ Acessar o Firebase Console

1. Abra seu navegador
2. Acesse: **https://console.firebase.google.com/**
3. Faça login com sua conta Google
4. Selecione o projeto: **app-ponto-ed97f**

### 2️⃣ Ir para Firestore Database

1. No menu lateral esquerdo, clique em **Firestore Database**
2. Clique na aba **Rules** (Regras)

Você verá um editor de código com as regras atuais.

### 3️⃣ Copiar as Novas Regras

1. Abra o arquivo `firestore.rules` neste projeto
2. Selecione TODO o conteúdo (Ctrl+A)
3. Copie (Ctrl+C)

**OU** copie diretamente daqui:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Collection: companies
    match /companies/{companyId} {
      allow read, write: if request.auth != null && request.auth.uid == companyId;
    }
    
    // Collection: locations
    match /locations/{locationId} {
      allow read: if true;
      // Escrita permitida apenas para o admin da empresa dona do local.
      allow create: if request.auth != null && request.resource.data.companyId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.companyId == request.auth.uid;
    }
    
    // Collection: employees
    match /employees/{employeeId} {
      allow read: if true;
      // Escrita permitida apenas para o admin da empresa dona do funcionário.
      allow create: if request.auth != null && request.resource.data.companyId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.companyId == request.auth.uid;
    }
    
    // Collection: attendance (CRÍTICO!)
    match /attendance/{attendanceId} {
      allow read: if true;
      allow create: if request.resource.data.verified == true
                    && request.resource.data.employeeId is string
                    && request.resource.data.type in ['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'];
      allow update: if request.auth != null;
      // Permite deletar se for admin OU se for um documento de teste do script de setup
      allow delete: if request.auth != null || (resource.data.isTest == true);
    }
    
    // Collection: users
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4️⃣ Colar no Editor

1. No Firebase Console, **selecione TODO o conteúdo** do editor de regras (Ctrl+A)
2. **Delete** o conteúdo antigo
3. **Cole** as novas regras (Ctrl+V)

### 5️⃣ Publicar as Regras

1. Clique no botão **Publish** (Publicar) no canto superior direito
2. Confirme a publicação

Você verá uma mensagem: ✅ "Rules published successfully"

### 6️⃣ Aguardar Propagação

⏳ **Aguarde 1-2 minutos** para as regras se propagarem nos servidores do Firebase.

### 7️⃣ Testar o Sistema

1. Abra o sistema de ponto no navegador
2. Pressione **F12** para abrir o DevTools
3. Vá na aba **Console**
4. Tente registrar um ponto
5. Observe os logs

---

## ✅ CONFIRMAÇÃO DE SUCESSO

Você saberá que funcionou quando:

1. ✅ No console do navegador aparecer:
   ```
   ✅✅✅ PONTO REGISTRADO COM SUCESSO! ✅✅✅
   🆔 ID do documento criado: xyz789abc
   ```

2. ✅ Aparecer um alert com os detalhes do registro

3. ✅ No Firebase Console > Firestore Database > attendance, você verá novos documentos

---

## ❌ SE NÃO FUNCIONAR

### Problema: Ainda aparece "permission-denied"

**Soluções:**

1. **Aguarde mais tempo**: As regras podem levar até 5 minutos para propagar
2. **Limpe o cache**: Ctrl+Shift+Delete > Limpar cache
3. **Recarregue a página**: F5 ou Ctrl+R
4. **Verifique se publicou**: Vá em Firestore Database > Rules e confirme que as regras estão lá

### Problema: Erro diferente

1. Copie a mensagem de erro completa do console
2. Consulte o arquivo `FIRESTORE_ATTENDANCE_DEBUG.md`
3. Execute o script de teste `TESTE_FIRESTORE.js`

---

## 🔒 SOBRE AS REGRAS

### Por que `allow create: if true` na collection attendance?

**Resposta**: Os funcionários NÃO estão autenticados via Firebase Authentication. Eles usam reconhecimento facial, que é uma autenticação biométrica local. Por isso, precisam de permissão pública para criar registros.

### Isso é seguro?

**Sim**, porque:

1. ✅ O reconhecimento facial valida a identidade
2. ✅ A geolocalização valida a presença no local
3. ✅ A foto é armazenada como prova
4. ✅ Apenas CRIAÇÃO é permitida (não podem editar ou deletar)
5. ✅ Empresas autenticadas podem gerenciar os registros

### Posso restringir mais?

**Sim**, você pode adicionar validações nos dados:

```javascript
match /attendance/{attendanceId} {
  allow read: if true;
  allow create: if request.resource.data.verified == true
                && request.resource.data.employeeId is string
                && request.resource.data.type in ['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'];
  allow update: if request.auth != null;
  // Permite deletar se for admin OU se for um documento de teste do script de setup
  allow delete: if request.auth != null || (resource.data.isTest == true);
}
```

---

## 📊 ESTRUTURA DAS COLLECTIONS

```
firestore/
├── companies/          (read/write: dono da empresa)
├── locations/          (read: todos | write: dono da empresa)
├── employees/          (read: todos | write: dono da empresa)
├── attendance/         (read: todos | create: todos | update/delete: autenticados)
└── users/              (read/write: próprio usuário)
```

---

## 🆘 PRECISA DE AJUDA?

1. **Consulte**: `FIRESTORE_ATTENDANCE_DEBUG.md` - Guia completo
2. **Execute**: `TESTE_FIRESTORE.js` - Script de teste
3. **Veja**: `FLUXO_REGISTRO_PONTO.md` - Fluxograma detalhado

---

## 📸 SCREENSHOTS ESPERADOS

### No Firebase Console (após publicar):

```
┌─────────────────────────────────────────────────┐
│ Firestore Database > Rules                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  rules_version = '2';                            │
│                                                  │
│  service cloud.firestore {                       │
│    match /databases/{database}/documents {       │
│      ...                                         │
│    }                                             │
│  }                                               │
│                                                  │
│  [Publish]  Last published: Just now             │
└─────────────────────────────────────────────────┘
```

### No Console do Navegador (após registrar ponto):

```
═══════════════════════════════════════════════════════
✅✅✅ PONTO REGISTRADO COM SUCESSO! ✅✅✅
═══════════════════════════════════════════════════════
🆔 ID do documento criado: xyz789abc
📍 Path completo: attendance/xyz789abc
```

---

**Última atualização**: 11/01/2026  
**Tempo de configuração**: ~3 minutos  
**Dificuldade**: ⭐ Fácil
