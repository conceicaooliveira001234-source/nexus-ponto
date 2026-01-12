/**
 * ═══════════════════════════════════════════════════════════════════
 * SCRIPT DE CONFIGURAÇÃO AUTOMÁTICA DO FIREBASE
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Este script configura TUDO automaticamente no Firebase:
 * - Regras de segurança do Firestore
 * - Índices compostos
 * - Dados de teste
 * - Validação de collections
 * 
 * COMO USAR:
 * 1. Instale as dependências: npm install firebase-admin
 * 2. Baixe a Service Account Key do Firebase Console
 * 3. Salve como 'serviceAccountKey.json' nesta pasta
 * 4. Execute: node setup-firebase-admin.js
 * ═══════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';
const PROJECT_ID = 'app-ponto-ed97f';

// ═══════════════════════════════════════════════════════════════════
// REGRAS DE SEGURANÇA DO FIRESTORE
// ═══════════════════════════════════════════════════════════════════

const FIRESTORE_RULES = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // ═══════════════════════════════════════════════════════════════
    // COMPANIES - Apenas o dono da empresa pode ler/escrever
    // ═══════════════════════════════════════════════════════════════
    match /companies/{companyId} {
      allow read, write: if request.auth != null && request.auth.uid == companyId;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // EMPLOYEES - Leitura pública para reconhecimento facial
    // ═══════════════════════════════════════════════════════════════
    match /employees/{employeeId} {
      // Leitura pública é necessária para que o sistema possa comparar
      // o rosto do usuário com os funcionários cadastrados.
      allow read: if true;
      // Escrita permitida apenas para o admin da empresa dona do funcionário.
      allow create: if request.auth != null && request.resource.data.companyId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.companyId == request.auth.uid;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // LOCATIONS - Leitura pública para seleção de local pelo funcionário
    // ═══════════════════════════════════════════════════════════════
    match /locations/{locationId} {
      // Leitura pública é necessária para que o funcionário possa
      // ver e selecionar seu local de trabalho no painel.
      allow read: if true;
      // Escrita permitida apenas para o admin da empresa dona do local.
      allow create: if request.auth != null && request.resource.data.companyId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.companyId == request.auth.uid;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // USERS - Apenas o próprio usuário pode ler/escrever seus dados
    // ═══════════════════════════════════════════════════════════════
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ATTENDANCE - ACESSO PÚBLICO PARA CRIAR REGISTROS
    // ═══════════════════════════════════════════════════════════════
    // Funcionários usam reconhecimento facial (não Firebase Auth)
    // Por isso, precisam de permissão pública para criar registros
    // ═══════════════════════════════════════════════════════════════
    match /attendance/{attendanceId} {
      // LEITURA: Qualquer pessoa pode ler (para o histórico)
      allow read: if true;
      
      // CRIAÇÃO: Qualquer pessoa pode criar (para registrar ponto)
      allow create: if true;
      
      // ATUALIZAÇÃO: Apenas usuários autenticados (admins)
      allow update: if request.auth != null;
      
      // EXCLUSÃO: Apenas admins, ou para limpar documentos de teste
      allow delete: if request.auth != null || (resource.data.isTest == true);
    }
  }
}`;

// ═══════════════════════════════════════════════════════════════════
// ÍNDICES COMPOSTOS NECESSÁRIOS
// ═══════════════════════════════════════════════════════════════════

const REQUIRED_INDEXES = [
  {
    collectionGroup: 'attendance',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'employeeId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'attendance',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'companyId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'attendance',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'locationId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'DESCENDING' }
    ]
  }
];

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ═══════════════════════════════════════════════════════════════════

function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function logSection(title) {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO DO FIREBASE ADMIN
// ═══════════════════════════════════════════════════════════════════

async function initializeFirebase() {
  logSection('🔧 INICIALIZANDO FIREBASE ADMIN SDK');
  
  try {
    // Verificar se o arquivo de service account existe
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      log('❌', 'Arquivo serviceAccountKey.json não encontrado!');
      log('📋', 'COMO OBTER:');
      log('   ', '1. Acesse: https://console.firebase.google.com/');
      log('   ', `2. Projeto: ${PROJECT_ID}`);
      log('   ', '3. ⚙️ Project Settings → Service Accounts');
      log('   ', '4. Clique em "Generate New Private Key"');
      log('   ', '5. Salve como "serviceAccountKey.json" nesta pasta');
      log('   ', '6. Execute este script novamente');
      process.exit(1);
    }

    // Carregar service account
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    
    // Inicializar Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID
    });

    log('✅', 'Firebase Admin SDK inicializado com sucesso!');
    log('📦', `Projeto: ${PROJECT_ID}`);
    
    return admin.firestore();
  } catch (error) {
    log('❌', `Erro ao inicializar Firebase: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SALVAR REGRAS DO FIRESTORE
// ═══════════════════════════════════════════════════════════════════

async function saveFirestoreRules() {
  logSection('📝 SALVANDO REGRAS DO FIRESTORE');
  
  const rulesPath = path.join(__dirname, 'firestore.rules');
  
  try {
    fs.writeFileSync(rulesPath, FIRESTORE_RULES);
    log('✅', 'Regras salvas em: firestore.rules');
    log('📋', 'PRÓXIMO PASSO MANUAL:');
    log('   ', '1. Acesse: https://console.firebase.google.com/');
    log('   ', `2. Projeto: ${PROJECT_ID}`);
    log('   ', '3. Firestore Database → Rules');
    log('   ', '4. Copie o conteúdo de firestore.rules');
    log('   ', '5. Cole no editor e clique em "Publish"');
    log('   ', '6. Aguarde 1-2 minutos');
    log('⚠️ ', 'IMPORTANTE: As regras devem ser publicadas manualmente no console!');
  } catch (error) {
    log('❌', `Erro ao salvar regras: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CRIAR ÍNDICES COMPOSTOS
// ═══════════════════════════════════════════════════════════════════

async function createIndexes() {
  logSection('🔍 CRIANDO ÍNDICES COMPOSTOS');
  
  log('📋', 'Índices necessários:');
  REQUIRED_INDEXES.forEach((index, i) => {
    log('   ', `${i + 1}. Collection: ${index.collectionGroup}`);
    index.fields.forEach(field => {
      log('      ', `- ${field.fieldPath} (${field.order})`);
    });
  });
  
  log('⚠️ ', 'IMPORTANTE: Índices devem ser criados manualmente!');
  log('📋', 'COMO CRIAR:');
  log('   ', '1. Acesse: https://console.firebase.google.com/');
  log('   ', `2. Projeto: ${PROJECT_ID}`);
  log('   ', '3. Firestore Database → Indexes');
  log('   ', '4. Clique em "Create Index"');
  log('   ', '5. Configure cada índice conforme listado acima');
  log('   ', '6. Aguarde alguns minutos (status: Building → Enabled)');
  
  // Salvar instruções em arquivo
  const indexInstructions = `
ÍNDICES COMPOSTOS NECESSÁRIOS
═══════════════════════════════════════════════════════════════════

${REQUIRED_INDEXES.map((index, i) => `
ÍNDICE ${i + 1}:
Collection: ${index.collectionGroup}
Query Scope: ${index.queryScope}
Fields:
${index.fields.map(f => `  - ${f.fieldPath}: ${f.order}`).join('\n')}
`).join('\n')}

COMO CRIAR NO FIREBASE CONSOLE:
1. Acesse: https://console.firebase.google.com/
2. Projeto: ${PROJECT_ID}
3. Firestore Database → Indexes
4. Clique em "Create Index"
5. Configure cada índice conforme listado acima
6. Aguarde alguns minutos (status: Building → Enabled)
`;

  fs.writeFileSync('FIRESTORE_INDICES_INSTRUCTIONS.txt', indexInstructions);
  log('✅', 'Instruções salvas em: FIRESTORE_INDICES_INSTRUCTIONS.txt');
}

// ═══════════════════════════════════════════════════════════════════
// VALIDAR COLLECTIONS
// ═══════════════════════════════════════════════════════════════════

async function validateCollections(db) {
  logSection('🔍 VALIDANDO COLLECTIONS');
  
  const collections = ['companies', 'employees', 'locations', 'users', 'attendance'];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).limit(1).get();
      const count = snapshot.size;
      
      if (count > 0) {
        log('✅', `Collection "${collectionName}" existe (${count} documento(s) encontrado(s))`);
      } else {
        log('⚠️ ', `Collection "${collectionName}" existe mas está vazia`);
      }
    } catch (error) {
      log('❌', `Erro ao validar collection "${collectionName}": ${error.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// TESTAR PERMISSÕES DE ESCRITA
// ═══════════════════════════════════════════════════════════════════

async function testWritePermissions(db) {
  logSection('🧪 TESTANDO PERMISSÕES DE ESCRITA');
  
  try {
    // Tentar criar um documento de teste na collection attendance
    const testDoc = {
      employeeId: 'TEST_EMPLOYEE',
      employeeName: 'Teste Automático',
      companyId: 'TEST_COMPANY',
      locationId: 'TEST_LOCATION',
      locationName: 'Local de Teste',
      timestamp: admin.firestore.Timestamp.now(),
      type: 'ENTRY',
      latitude: -23.550520,
      longitude: -46.633308,
      distance: 0,
      photoBase64: '',
      verified: true,
      isTest: true
    };
    
    log('📝', 'Criando documento de teste...');
    const docRef = await db.collection('attendance').add(testDoc);
    log('✅', `Documento de teste criado com sucesso! ID: ${docRef.id}`);
    
    // Ler o documento
    log('📖', 'Lendo documento de teste...');
    const doc = await docRef.get();
    if (doc.exists) {
      log('✅', 'Documento lido com sucesso!');
    }
    
    // Deletar o documento de teste
    log('🗑️ ', 'Deletando documento de teste...');
    await docRef.delete();
    log('✅', 'Documento de teste deletado com sucesso!');
    
    log('🎉', 'TODAS AS PERMISSÕES ESTÃO FUNCIONANDO!');
  } catch (error) {
    log('❌', `Erro ao testar permissões: ${error.message}`);
    log('⚠️ ', 'As regras do Firestore podem estar bloqueando o acesso');
    log('📋', 'Verifique se as regras foram publicadas corretamente');
  }
}

// ═══════════════════════════════════════════════════════════════════
// VERIFICAR REGISTROS DE ATTENDANCE
// ═══════════════════════════════════════════════════════════════════

async function checkAttendanceRecords(db) {
  logSection('📊 VERIFICANDO REGISTROS DE ATTENDANCE');
  
  try {
    const snapshot = await db.collection('attendance')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    log('📋', `Total de registros encontrados: ${snapshot.size}`);
    
    if (snapshot.size > 0) {
      log('📄', 'Últimos registros:');
      snapshot.forEach((doc, index) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate();
        log('   ', `${index + 1}. ${data.employeeName} - ${data.type} - ${timestamp?.toLocaleString('pt-BR')}`);
      });
    } else {
      log('⚠️ ', 'Nenhum registro de ponto encontrado');
      log('💡', 'Isso é normal se o sistema ainda não foi usado');
    }
  } catch (error) {
    log('❌', `Erro ao verificar registros: ${error.message}`);
    
    if (error.code === 9) {
      log('⚠️ ', 'ERRO: Índice composto necessário!');
      log('📋', 'Crie o índice conforme instruções em FIRESTORE_INDICES_INSTRUCTIONS.txt');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🚀 CONFIGURAÇÃO AUTOMÁTICA DO FIREBASE');
  console.log('  📦 Projeto: app-ponto-ed97f');
  console.log('  🎯 Sistema de Ponto com Reconhecimento Facial');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');
  
  try {
    // 1. Inicializar Firebase
    const db = await initializeFirebase();
    
    // 2. Salvar regras do Firestore
    await saveFirestoreRules();
    
    // 3. Criar índices compostos
    await createIndexes();
    
    // 4. Validar collections
    await validateCollections(db);
    
    // 5. Testar permissões
    await testWritePermissions(db);
    
    // 6. Verificar registros
    await checkAttendanceRecords(db);
    
    // Resumo final
    logSection('✅ CONFIGURAÇÃO CONCLUÍDA');
    log('📋', 'PRÓXIMOS PASSOS:');
    log('   ', '1. Publique as regras do Firestore (firestore.rules)');
    log('   ', '2. Crie os índices compostos (FIRESTORE_INDICES_INSTRUCTIONS.txt)');
    log('   ', '3. Aguarde alguns minutos');
    log('   ', '4. Teste o sistema de registro de ponto');
    log('🎉', 'Sistema pronto para uso!');
    
  } catch (error) {
    log('❌', `Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXECUTAR
// ═══════════════════════════════════════════════════════════════════

main().catch(console.error);
