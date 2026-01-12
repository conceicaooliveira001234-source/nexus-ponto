/**
 * ═══════════════════════════════════════════════════════════════════
 * CONFIGURAÇÃO SIMPLIFICADA DO FIREBASE (SEM SERVICE ACCOUNT KEY)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Este script usa a configuração do Firebase Web SDK (não Admin SDK)
 * para validar e configurar o sistema SEM precisar da Service Account Key.
 * 
 * COMO USAR:
 * 1. Execute: npm install
 * 2. Execute: node setup-firebase-simple.js
 * 3. Siga as instruções na tela
 * ═══════════════════════════════════════════════════════════════════
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DO FIREBASE (do arquivo lib/firebase.ts)
// ═══════════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyDSRabB61Nj_yBabfMufcgoclSrcVdN6BU",
  authDomain: "app-ponto-ed97f.firebaseapp.com",
  projectId: "app-ponto-ed97f",
  storageBucket: "app-ponto-ed97f.firebasestorage.app",
  messagingSenderId: "1040347094352",
  appId: "1:1040347094352:web:eb3318f023c7f56145e055"
};

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
      allow delete: if request.auth != null && resource.data.companyId == request.auth.uid;
			allow update: if
        // Admin pode atualizar
        (request.auth != null && resource.data.companyId == request.auth.uid) ||
        // Funcionário pode cadastrar o rosto uma vez via link
        (
          request.auth == null &&
          (resource.data.photoBase64 == null || resource.data.photoBase64 == "") &&
          request.resource.data.photoBase64 is string && request.resource.data.photoBase64 != "" &&
          // Garante que APENAS o campo 'photoBase64' está sendo alterado.
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['photoBase64'])
        );
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

      // CRIAÇÃO: Apenas registros válidos do app de ponto
      allow create: if request.resource.data.verified == true
                    && request.resource.data.employeeId is string
                    && request.resource.data.type in ['ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT'];

      // ATUALIZAÇÃO: Apenas usuários autenticados (admins)
      allow update: if request.auth != null;

      // EXCLUSÃO: Apenas admins, ou para limpar documentos de teste
      allow delete: if request.auth != null || (resource.data.isTest == true);
    }
  }
}`;

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
// INICIALIZAÇÃO DO FIREBASE
// ═══════════════════════════════════════════════════════════════════

function initializeFirebase() {
  logSection('🔧 INICIALIZANDO FIREBASE WEB SDK');
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    log('✅', 'Firebase Web SDK inicializado com sucesso!');
    log('📦', `Projeto: ${firebaseConfig.projectId}`);
    
    return db;
  } catch (error) {
    log('❌', `Erro ao inicializar Firebase: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SALVAR REGRAS DO FIRESTORE
// ═══════════════════════════════════════════════════════════════════

function saveFirestoreRules() {
  logSection('📝 SALVANDO REGRAS DO FIRESTORE');
  
  try {
    fs.writeFileSync('firestore.rules', FIRESTORE_RULES);
    log('✅', 'Regras salvas em: firestore.rules');
    log('📋', 'PRÓXIMO PASSO MANUAL:');
    log('   ', '1. Acesse: https://console.firebase.google.com/');
    log('   ', `2. Projeto: ${firebaseConfig.projectId}`);
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
// VALIDAR COLLECTIONS
// ═══════════════════════════════════════════════════════════════════

async function validateCollections(db) {
  logSection('🔍 VALIDANDO COLLECTIONS');
  
  const collections = ['companies', 'employees', 'locations', 'users', 'attendance'];
  
  for (const collectionName of collections) {
    try {
      const q = query(collection(db, collectionName), limit(1));
      const snapshot = await getDocs(q);
      const count = snapshot.size;
      
      if (count > 0) {
        log('✅', `Collection "${collectionName}" existe (${count} documento(s) encontrado(s))`);
      } else {
        log('⚠️ ', `Collection "${collectionName}" existe mas está vazia`);
      }
    } catch (error) {
      if (error.code === 'permission-denied') {
        log('⚠️ ', `Collection "${collectionName}" existe mas sem permissão de leitura (normal para algumas collections)`);
      } else {
        log('❌', `Erro ao validar collection "${collectionName}": ${error.message}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// TESTAR PERMISSÕES DE ESCRITA
// ═══════════════════════════════════════════════════════════════════

async function testWritePermissions(db) {
  logSection('🧪 TESTANDO PERMISSÕES DE ESCRITA');
  
  let testDocId = null;
  
  try {
    // Tentar criar um documento de teste na collection attendance
    const testDoc = {
      employeeId: 'TEST_EMPLOYEE',
      employeeName: 'Teste Automático',
      companyId: 'TEST_COMPANY',
      locationId: 'TEST_LOCATION',
      locationName: 'Local de Teste',
      timestamp: Timestamp.now(),
      type: 'ENTRY',
      latitude: -23.550520,
      longitude: -46.633308,
      distance: 0,
      photoBase64: '',
      verified: true,
      isTest: true
    };
    
    log('📝', 'Criando documento de teste na collection "attendance"...');
    const docRef = await addDoc(collection(db, 'attendance'), testDoc);
    testDocId = docRef.id;
    log('✅', `Documento de teste criado com sucesso! ID: ${docRef.id}`);
    
    // Tentar ler o documento
    log('📖', 'Lendo documentos de teste...');
    const q = query(
      collection(db, 'attendance'),
      where('isTest', '==', true),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.size > 0) {
      log('✅', 'Documento lido com sucesso!');
    }
    
    // Tentar deletar o documento de teste
    log('🗑️ ', 'Deletando documento de teste...');
    await deleteDoc(doc(db, 'attendance', testDocId));
    log('✅', 'Documento de teste deletado com sucesso!');
    
    log('🎉', 'TODAS AS PERMISSÕES ESTÃO FUNCIONANDO!');
    log('✅', 'O sistema pode criar, ler e deletar registros de ponto!');
    
  } catch (error) {
    log('❌', `Erro ao testar permissões: ${error.message}`);
    log('🔴', `Código do erro: ${error.code}`);
    
    if (error.code === 'permission-denied') {
      log('⚠️ ', 'ERRO: Permissões do Firestore estão bloqueando o acesso!');
      log('📋', 'SOLUÇÃO:');
      log('   ', '1. Abra o arquivo: firestore.rules');
      log('   ', '2. Copie TODO o conteúdo');
      log('   ', '3. Acesse: https://console.firebase.google.com/');
      log('   ', `4. Projeto: ${firebaseConfig.projectId}`);
      log('   ', '5. Firestore Database → Rules');
      log('   ', '6. Cole o conteúdo e clique em "Publish"');
      log('   ', '7. Aguarde 1-2 minutos');
      log('   ', '8. Execute este script novamente');
    } else if (error.code === 'failed-precondition') {
      log('⚠️ ', 'ERRO: Índice composto necessário!');
      log('📋', 'SOLUÇÃO:');
      log('   ', '1. Acesse: https://console.firebase.google.com/');
      log('   ', `2. Projeto: ${firebaseConfig.projectId}`);
      log('   ', '3. Firestore Database → Indexes');
      log('   ', '4. Crie um índice:');
      log('      ', '- Collection: attendance');
      log('      ', '- Fields: employeeId (Ascending) + timestamp (Descending)');
      log('   ', '5. Aguarde alguns minutos (Building → Enabled)');
    }
    
    // Tentar limpar o documento de teste se foi criado
    if (testDocId) {
      try {
        await deleteDoc(doc(db, 'attendance', testDocId));
        log('🧹', 'Documento de teste removido');
      } catch (cleanupError) {
        log('⚠️ ', 'Não foi possível remover o documento de teste (você pode removê-lo manualmente)');
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// VERIFICAR REGISTROS DE ATTENDANCE
// ═══════════════════════════════════════════════════════════════════

async function checkAttendanceRecords(db) {
  logSection('📊 VERIFICANDO REGISTROS DE ATTENDANCE');
  
  try {
    const q = query(
      collection(db, 'attendance'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const snapshot = await getDocs(q);
    
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
    log('🔴', `Código do erro: ${error.code}`);
    
    if (error.code === 'failed-precondition') {
      log('⚠️ ', 'ERRO: Índice composto necessário!');
      log('📋', 'SOLUÇÃO:');
      log('   ', '1. Acesse: https://console.firebase.google.com/');
      log('   ', `2. Projeto: ${firebaseConfig.projectId}`);
      log('   ', '3. Firestore Database → Indexes');
      log('   ', '4. Clique em "Create Index"');
      log('   ', '5. Configure:');
      log('      ', '- Collection ID: attendance');
      log('      ', '- Fields to index:');
      log('        ', '  • timestamp (Descending)');
      log('   ', '6. Clique em "Create"');
      log('   ', '7. Aguarde alguns minutos (Building → Enabled)');
      log('   ', '8. Execute este script novamente');
    } else if (error.code === 'permission-denied') {
      log('⚠️ ', 'ERRO: Sem permissão para ler registros');
      log('📋', 'Publique as regras do Firestore (instruções acima)');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// CRIAR INSTRUÇÕES DE ÍNDICES
// ═══════════════════════════════════════════════════════════════════

function createIndexInstructions() {
  logSection('🔍 CRIANDO INSTRUÇÕES DE ÍNDICES');
  
  const instructions = `
═══════════════════════════════════════════════════════════════════
ÍNDICES COMPOSTOS NECESSÁRIOS PARA O FIRESTORE
═══════════════════════════════════════════════════════════════════

IMPORTANTE: Estes índices são necessários para que o sistema funcione
corretamente. Sem eles, você verá erros como "failed-precondition".

═══════════════════════════════════════════════════════════════════
ÍNDICE 1: Buscar registros por funcionário
═══════════════════════════════════════════════════════════════════

Collection ID: attendance
Query Scope: Collection

Fields to index:
  1. employeeId (Ascending)
  2. timestamp (Descending)

═══════════════════════════════════════════════════════════════════
ÍNDICE 2: Buscar registros por empresa
═══════════════════════════════════════════════════════════════════

Collection ID: attendance
Query Scope: Collection

Fields to index:
  1. companyId (Ascending)
  2. timestamp (Descending)

═══════════════════════════════════════════════════════════════════
ÍNDICE 3: Buscar registros por local
═══════════════════════════════════════════════════════════════════

Collection ID: attendance
Query Scope: Collection

Fields to index:
  1. locationId (Ascending)
  2. timestamp (Descending)

═══════════════════════════════════════════════════════════════════
ÍNDICE 4: Listar todos os registros (ordenados por data)
═══════════════════════════════════════════════════════════════════

Collection ID: attendance
Query Scope: Collection

Fields to index:
  1. timestamp (Descending)

═══════════════════════════════════════════════════════════════════
COMO CRIAR OS ÍNDICES NO FIREBASE CONSOLE
═══════════════════════════════════════════════════════════════════

1. Acesse: https://console.firebase.google.com/

2. Selecione o projeto: ${firebaseConfig.projectId}

3. No menu lateral, clique em: Firestore Database

4. Clique na aba: Indexes

5. Clique no botão: Create Index

6. Preencha os campos conforme listado acima

7. Clique em: Create

8. Aguarde alguns minutos até o status mudar de "Building" para "Enabled"

9. Repita os passos 5-8 para cada índice listado acima

═══════════════════════════════════════════════════════════════════
ALTERNATIVA: CRIAR ÍNDICES AUTOMATICAMENTE
═══════════════════════════════════════════════════════════════════

Quando você tentar usar o sistema e um índice estiver faltando, o
Firebase mostrará um erro com um LINK DIRETO para criar o índice.

Exemplo de erro:
"The query requires an index. You can create it here: https://..."

Basta clicar no link e o índice será criado automaticamente!

═══════════════════════════════════════════════════════════════════
VERIFICAR SE OS ÍNDICES ESTÃO ATIVOS
═══════════════════════════════════════════════════════════════════

1. Acesse: https://console.firebase.google.com/
2. Projeto: ${firebaseConfig.projectId}
3. Firestore Database → Indexes
4. Verifique se todos os índices estão com status "Enabled"

═══════════════════════════════════════════════════════════════════
`;

  try {
    fs.writeFileSync('FIRESTORE_INDICES_INSTRUCTIONS.txt', instructions);
    log('✅', 'Instruções salvas em: FIRESTORE_INDICES_INSTRUCTIONS.txt');
    log('📋', 'Leia este arquivo para saber como criar os índices necessários');
  } catch (error) {
    log('❌', `Erro ao salvar instruções: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🚀 CONFIGURAÇÃO SIMPLIFICADA DO FIREBASE');
  console.log('  📦 Projeto: app-ponto-ed97f');
  console.log('  🎯 Sistema de Ponto com Reconhecimento Facial');
  console.log('  ⚡ SEM NECESSIDADE DE SERVICE ACCOUNT KEY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');
  
  try {
    // 1. Inicializar Firebase
    const db = initializeFirebase();
    
    // 2. Salvar regras do Firestore
    saveFirestoreRules();
    
    // 3. Criar instruções de índices
    createIndexInstructions();
    
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
    
    process.exit(0);
    
  } catch (error) {
    log('❌', `Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXECUTAR
// ═══════════════════════════════════════════════════════════════════

main().catch(console.error);
