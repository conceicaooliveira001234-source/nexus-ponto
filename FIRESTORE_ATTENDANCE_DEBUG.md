# 🔥 GUIA DE DEBUG - REGISTRO DE PONTO NO FIRESTORE

## 📋 ESTRUTURA DO DOCUMENTO DE ATTENDANCE

Cada registro de ponto salvo na collection `attendance` possui a seguinte estrutura:

```typescript
{
  // Identificação do Funcionário
  employeeId: string,           // ID do documento do funcionário
  employeeName: string,          // Nome completo do funcionário
  
  // Identificação da Empresa e Local
  companyId: string,             // ID da empresa (tenant)
  locationId: string,            // ID do local de trabalho
  locationName: string,          // Nome do local de trabalho
  
  // Dados do Registro
  timestamp: Timestamp,          // Data/hora do registro (Firestore Timestamp)
  type: string,                  // 'ENTRY' | 'BREAK_START' | 'BREAK_END' | 'EXIT'
  
  // Geolocalização
  latitude: number,              // Latitude do funcionário no momento do registro
  longitude: number,             // Longitude do funcionário no momento do registro
  distance: number,              // Distância em metros do local de trabalho
  
  // Biometria
  photoBase64: string,           // Foto capturada durante o reconhecimento facial (base64)
  verified: boolean              // Se passou pelo reconhecimento facial (sempre true)
}
```

### Exemplo de Documento Real:
```json
{
  "employeeId": "abc123xyz",
  "employeeName": "João Silva",
  "companyId": "company_001",
  "locationId": "location_001",
  "locationName": "Matriz - São Paulo",
  "timestamp": "2026-01-11T14:30:00.000Z",
  "type": "ENTRY",
  "latitude": -23.550520,
  "longitude": -46.633308,
  "distance": 45.5,
  "photoBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "verified": true
}
```

---

## 🔒 REGRAS DE SEGURANÇA DO FIRESTORE

### ⚠️ PROBLEMA MAIS COMUM: PERMISSÕES BLOQUEADAS

Se você está vendo o erro `permission-denied`, suas regras do Firestore estão bloqueando a escrita.

### 📝 REGRAS RECOMENDADAS PARA PRODUÇÃO

Cole estas regras no **Firebase Console > Firestore Database > Rules**:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Collection: companies
    match /companies/{companyId} {
      // Permitir leitura e escrita autenticada
      allow read, write: if request.auth != null && request.auth.uid == companyId;
    }
    
    // Collection: locations
    match /locations/{locationId} {
      // Permitir leitura para todos (necessário para login de funcionários)
      allow read: if true;
      // Permitir escrita apenas para usuários autenticados (donos da empresa)
      allow create: if request.auth != null && request.resource.data.companyId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.companyId == request.auth.uid;
    }
    
    // Collection: employees
    match /employees/{employeeId} {
      // Permitir leitura para todos (necessário para reconhecimento facial)
      allow read: if true;
      // Permitir escrita apenas para usuários autenticados (donos da empresa)
      allow create: if request.auth != null && request.resource.data.companyId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.companyId == request.auth.uid;
    }
    
    // Collection: attendance (CRÍTICO!)
    match /attendance/{attendanceId} {
      // Permitir leitura para todos os registros
      allow read: if true;
      
      // Permitir criação de novos registros se forem válidos (ESSENCIAL!)
      allow create: if request.resource.data.verified == true
                    && request.resource.data.employeeId is string
                    && request.resource.data.type in ['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'];
      
      // Permitir atualização e exclusão apenas para autenticados
      allow update: if request.auth != null;
      allow delete: if request.auth != null || (resource.data.isTest == true);
    }
    
    // Collection: users
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 🚨 REGRAS TEMPORÁRIAS PARA TESTE (NÃO USE EM PRODUÇÃO!)

Se você quer testar rapidamente se o problema é de permissões, use estas regras **TEMPORARIAMENTE**:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **ATENÇÃO**: Estas regras permitem acesso total ao banco. Use APENAS para teste e depois substitua pelas regras de produção!

---

## 🧪 COMO TESTAR SE O FIRESTORE ESTÁ FUNCIONANDO

### Teste 1: Verificar Conexão no Console do Navegador

1. Abra o sistema no navegador
2. Pressione `F12` para abrir o DevTools
3. Vá na aba **Console**
4. Tente registrar um ponto
5. Observe os logs detalhados que foram adicionados

### Teste 2: Verificar no Firebase Console

1. Acesse: https://console.firebase.google.com/
2. Selecione seu projeto: **app-ponto-ed97f**
3. Vá em **Firestore Database**
4. Procure pela collection **attendance**
5. Verifique se novos documentos estão sendo criados

### Teste 3: Criar Documento Manualmente

Para testar se as permissões estão corretas, crie um documento de teste manualmente:

1. No Firebase Console, vá em **Firestore Database**
2. Clique em **+ Start collection**
3. Collection ID: `attendance`
4. Document ID: (deixe auto-gerar)
5. Adicione os campos:
   ```
   employeeId: "test_001"
   employeeName: "Teste Manual"
   companyId: "test_company"
   locationId: "test_location"
   locationName: "Local de Teste"
   timestamp: (clique em "timestamp" e selecione a data/hora atual)
   type: "ENTRY"
   latitude: -23.550520
   longitude: -46.633308
   distance: 0
   photoBase64: "test"
   verified: true
   ```
6. Clique em **Save**

Se conseguir criar manualmente, o problema NÃO é de permissões.

---

## 🔍 INTERPRETANDO OS LOGS DO CONSOLE

Com as correções implementadas, você verá logs detalhados no console:

### ✅ Logs de Sucesso:
```
═══════════════════════════════════════════════════════
🔍 INICIANDO PROCESSO DE REGISTRO DE PONTO
═══════════════════════════════════════════════════════
📋 ETAPA 1: Validando dados obrigatórios...
✅ Tipo de ponto validado: ENTRY
✅ Funcionário validado: João Silva (ID: abc123)
✅ Contexto validado - Empresa: ACME Corp | Local: Matriz
✅ Posição validada - Lat: -23.550520 | Lng: -46.633308
✅ Local de trabalho validado: Matriz
✅ TODAS AS VALIDAÇÕES PASSARAM!
───────────────────────────────────────────────────────
💾 ETAPA 2: Iniciando registro de ponto do tipo: ENTRY
📸 ETAPA 3: Capturando foto do vídeo...
✅ Foto capturada com sucesso (tamanho: 45678 caracteres)
📏 ETAPA 4: Calculando distância até o local de trabalho...
✅ Distância calculada: 45.50m do local de trabalho
📦 ETAPA 5: Preparando dados para salvamento...
───────────────────────────────────────────────────────
💾 ETAPA 6: SALVANDO NO FIRESTORE...
📤 Enviando dados para o Firestore...
═══════════════════════════════════════════════════════
✅✅✅ PONTO REGISTRADO COM SUCESSO! ✅✅✅
═══════════════════════════════════════════════════════
🆔 ID do documento criado: xyz789abc
📍 Path completo: attendance/xyz789abc
```

### ❌ Logs de Erro - Permissão Negada:
```
═══════════════════════════════════════════════════════
❌❌❌ ERRO AO REGISTRAR PONTO ❌❌❌
═══════════════════════════════════════════════════════
🔴 Tipo do erro: FirebaseError
🔴 Mensagem: Missing or insufficient permissions
🔴 Código: permission-denied
💡 SOLUÇÃO: Configure as regras do Firestore para permitir escrita na collection "attendance"
```

**SOLUÇÃO**: Atualize as regras de segurança do Firestore (veja seção acima).

### ❌ Logs de Erro - Conexão:
```
🔴 Tipo do erro: FirebaseError
🔴 Código: unavailable
🔴 Mensagem: Failed to get document because the client is offline
```

**SOLUÇÃO**: Verifique sua conexão com a internet.

---

## 🛠️ CHECKLIST DE TROUBLESHOOTING

Use este checklist para diagnosticar o problema:

- [ ] **Passo 1**: Abrir o console do navegador (F12)
- [ ] **Passo 2**: Tentar registrar um ponto
- [ ] **Passo 3**: Verificar se aparecem os logs detalhados
- [ ] **Passo 4**: Se aparecer erro `permission-denied`:
  - [ ] Ir no Firebase Console
  - [ ] Firestore Database > Rules
  - [ ] Atualizar as regras (copiar da seção acima)
  - [ ] Clicar em **Publish**
  - [ ] Aguardar 1-2 minutos para propagar
  - [ ] Tentar novamente
- [ ] **Passo 5**: Se aparecer erro de conexão:
  - [ ] Verificar internet
  - [ ] Verificar se o Firebase está online: https://status.firebase.google.com/
- [ ] **Passo 6**: Se não aparecer nenhum erro mas também não salvar:
  - [ ] Verificar se o `db` está inicializado (deve aparecer no log)
  - [ ] Verificar se o arquivo `lib/firebase.ts` está correto
- [ ] **Passo 7**: Verificar no Firebase Console se o documento foi criado:
  - [ ] Firestore Database > attendance
  - [ ] Procurar pelo ID do documento que apareceu no log

---

## 📊 CAMPOS OBRIGATÓRIOS

Todos estes campos são obrigatórios e validados antes de salvar:

| Campo | Tipo | Validação |
|-------|------|-----------|
| `employeeId` | string | Deve existir (vem do funcionário identificado) |
| `employeeName` | string | Deve existir |
| `companyId` | string | Deve existir (vem do contexto) |
| `locationId` | string | Deve existir (vem do contexto) |
| `locationName` | string | Deve existir |
| `timestamp` | Timestamp | Gerado automaticamente |
| `type` | string | Deve ser um dos 4 tipos válidos |
| `latitude` | number | Obtido da geolocalização |
| `longitude` | number | Obtido da geolocalização |
| `distance` | number | Calculado automaticamente |
| `photoBase64` | string | Capturado da câmera (pode ser vazio) |
| `verified` | boolean | Sempre `true` |

---

## 🎯 PRÓXIMOS PASSOS

1. **Teste o sistema** com as correções implementadas
2. **Observe os logs** no console do navegador
3. **Se aparecer erro de permissão**: Atualize as regras do Firestore
4. **Verifique no Firebase Console** se os documentos estão sendo criados
5. **Reporte o resultado**: Copie os logs do console e envie para análise

---

## 📞 SUPORTE

Se após seguir todos os passos o problema persistir, forneça:

1. **Screenshot dos logs do console** (toda a sequência desde "INICIANDO PROCESSO" até o erro)
2. **Screenshot das regras do Firestore** (Firebase Console > Firestore Database > Rules)
3. **Screenshot da collection attendance** no Firebase Console
4. **Mensagem de erro completa** que aparece no alert

---

## ✅ CONFIRMAÇÃO DE SUCESSO

Você saberá que está funcionando quando:

1. ✅ Aparecer no console: `✅✅✅ PONTO REGISTRADO COM SUCESSO! ✅✅✅`
2. ✅ Aparecer o ID do documento criado
3. ✅ Aparecer um alert com os detalhes do registro
4. ✅ O documento aparecer no Firebase Console em `attendance`
5. ✅ O histórico de pontos atualizar automaticamente na tela

---

**Última atualização**: 11/01/2026
**Versão do sistema**: 2.0 (com logs detalhados)
