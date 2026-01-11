/**
 * SCRIPT DE TESTE RÁPIDO - FIRESTORE ATTENDANCE
 * 
 * Este script pode ser executado no console do navegador (F12)
 * para testar se o Firestore está aceitando escritas na collection "attendance"
 * 
 * COMO USAR:
 * 1. Abra o sistema no navegador
 * 2. Pressione F12 para abrir o DevTools
 * 3. Vá na aba "Console"
 * 4. Copie e cole este script completo
 * 5. Pressione Enter
 * 6. Observe o resultado
 */

(async function testFirestoreAttendance() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 TESTE DE ESCRITA NO FIRESTORE - COLLECTION ATTENDANCE');
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Importar Firebase (assumindo que já está carregado na página)
    const { db } = window; // Se não funcionar, tente: const db = firebase.firestore();
    
    if (!db) {
      console.error('❌ Firebase Database não encontrado!');
      console.log('💡 Certifique-se de que o sistema está carregado completamente');
      return;
    }
    
    console.log('✅ Firebase Database encontrado');
    console.log('📤 Tentando criar documento de teste...');
    
    // Importar funções do Firestore
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');
    
    // Criar documento de teste
    const testData = {
      employeeId: 'TEST_' + Date.now(),
      employeeName: 'Teste Automático',
      companyId: 'test_company',
      locationId: 'test_location',
      locationName: 'Local de Teste',
      timestamp: Timestamp.now(),
      type: 'ENTRY',
      latitude: -23.550520,
      longitude: -46.633308,
      distance: 0,
      photoBase64: 'data:image/jpeg;base64,TEST',
      verified: true,
      isTest: true // Flag para identificar como teste
    };
    
    console.log('📋 Dados do teste:', testData);
    console.log('⏳ Enviando para Firestore...');
    
    const docRef = await addDoc(collection(db, 'attendance'), testData);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅✅✅ TESTE BEM-SUCEDIDO! ✅✅✅');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🆔 ID do documento criado:', docRef.id);
    console.log('📍 Path completo: attendance/' + docRef.id);
    console.log('');
    console.log('🎉 O Firestore está funcionando corretamente!');
    console.log('💡 Você pode deletar este documento de teste no Firebase Console');
    console.log('═══════════════════════════════════════════════════════');
    
    return {
      success: true,
      documentId: docRef.id,
      message: 'Firestore está funcionando! O problema pode estar em outro lugar.'
    };
    
  } catch (error) {
    console.log('═══════════════════════════════════════════════════════');
    console.error('❌❌❌ TESTE FALHOU ❌❌❌');
    console.log('═══════════════════════════════════════════════════════');
    console.error('🔴 Tipo do erro:', error?.name || 'Desconhecido');
    console.error('🔴 Mensagem:', error?.message || 'Sem mensagem');
    console.error('🔴 Código:', error?.code || 'Sem código');
    console.error('🔴 Erro completo:', error);
    console.log('═══════════════════════════════════════════════════════');
    
    if (error?.code === 'permission-denied') {
      console.log('');
      console.log('🔒 DIAGNÓSTICO: ERRO DE PERMISSÃO');
      console.log('');
      console.log('📝 SOLUÇÃO:');
      console.log('1. Acesse: https://console.firebase.google.com/');
      console.log('2. Selecione o projeto: app-ponto-ed97f');
      console.log('3. Vá em: Firestore Database > Rules');
      console.log('4. Copie as regras do arquivo "firestore.rules"');
      console.log('5. Cole no editor e clique em "Publish"');
      console.log('6. Aguarde 1-2 minutos e teste novamente');
      console.log('');
    } else if (error?.code === 'unavailable') {
      console.log('');
      console.log('🌐 DIAGNÓSTICO: ERRO DE CONEXÃO');
      console.log('');
      console.log('📝 SOLUÇÃO:');
      console.log('1. Verifique sua conexão com a internet');
      console.log('2. Verifique se o Firebase está online:');
      console.log('   https://status.firebase.google.com/');
      console.log('3. Tente recarregar a página');
      console.log('');
    } else {
      console.log('');
      console.log('❓ DIAGNÓSTICO: ERRO DESCONHECIDO');
      console.log('');
      console.log('📝 PRÓXIMOS PASSOS:');
      console.log('1. Copie a mensagem de erro acima');
      console.log('2. Verifique o arquivo lib/firebase.ts');
      console.log('3. Verifique se o projeto Firebase está configurado corretamente');
      console.log('');
    }
    
    return {
      success: false,
      error: error?.message || 'Erro desconhecido',
      code: error?.code || 'unknown'
    };
  }
})();

/**
 * TESTE ALTERNATIVO - VERIFICAR CONEXÃO
 * 
 * Se o teste acima não funcionar, tente este:
 */

/*
(async function testFirebaseConnection() {
  console.log('🔍 Verificando conexão com Firebase...');
  
  try {
    const { db } = window;
    
    if (!db) {
      console.error('❌ Firebase não encontrado');
      return;
    }
    
    console.log('✅ Firebase encontrado');
    console.log('📊 Tipo:', typeof db);
    console.log('📋 Objeto:', db);
    
    // Tentar ler uma collection
    const { collection, getDocs } = await import('firebase/firestore');
    const querySnapshot = await getDocs(collection(db, 'attendance'));
    
    console.log('✅ Leitura bem-sucedida!');
    console.log('📊 Documentos encontrados:', querySnapshot.size);
    
    querySnapshot.forEach((doc) => {
      console.log('📄 Documento:', doc.id, doc.data());
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
})();
*/
