// netlify/functions/ai-chat.js - Version ultra-robuste avec debugging
exports.handler = async (event, context) => {
  // Headers CORS toujours en premier
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Content-Type': 'application/json'
  };

  // Log de démarrage
  console.log('🚀 Function START - Method:', event.httpMethod);
  
  try {
    // Gestion CORS
    if (event.httpMethod === 'OPTIONS') {
      console.log('✅ CORS preflight OK');
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ message: 'CORS OK' }) 
      };
    }

    // Test GET
    if (event.httpMethod === 'GET') {
      console.log('✅ GET request - Testing API');
      const testResult = {
        message: 'Fonction ai-chat opérationnelle!',
        timestamp: new Date().toISOString(),
        hasAnthropicKey: !!process.env.ANTHROPIC_KEY,
        keyLength: process.env.ANTHROPIC_KEY ? process.env.ANTHROPIC_KEY.length : 0,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'unknown'
      };
      console.log('📤 Sending test result:', testResult);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(testResult)
      };
    }

    // Vérification méthode POST
    if (event.httpMethod !== 'POST') {
      console.log('❌ Method not allowed:', event.httpMethod);
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed', method: event.httpMethod })
      };
    }

    // POST - Vérification clé API
    if (!process.env.ANTHROPIC_KEY) {
      console.error('❌ ANTHROPIC_KEY missing');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Configuration manquante',
          details: 'ANTHROPIC_KEY non définie dans les variables d\'environnement Netlify',
          help: 'Ajoutez ANTHROPIC_KEY dans Site Settings > Environment Variables'
        })
      };
    }

    // Parse du body
    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
      console.log('📨 Request parsed successfully');
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'JSON invalide',
          details: parseError.message,
          receivedBody: event.body?.substring(0, 200)
        })
      };
    }

    const { message, systemPrompt, conversationHistory, context } = requestData;
    
    if (!message) {
      console.log('❌ No message provided');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Message requis',
          received: Object.keys(requestData)
        })
      };
    }

    console.log('📨 Processing message:', message.substring(0, 50) + '...');

    // Essai avec un seul modèle pour simplifier
    const model = 'claude-3-haiku-20240307'; // Le plus simple et rapide
    
    try {
      console.log(`🔄 Trying model: ${model}`);
      
      // Construction simple du prompt
      const finalPrompt = systemPrompt ? 
        `${systemPrompt}\n\nMessage: ${message}` : 
        `Tu es un assistant IA spécialisé dans la création de sites web.\n\nMessage: ${message}`;

      console.log('📝 Prompt length:', finalPrompt.length);

      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4000, // Réduit pour éviter les timeouts
          temperature: 0.7,
          messages: [
            {
              role: 'user',
              content: finalPrompt
            }
          ]
        })
      });

      console.log(`📡 Claude response status: ${claudeResponse.status}`);

      if (!claudeResponse.ok) {
        const errorText = await claudeResponse.text();
        console.error('❌ Claude API error:', claudeResponse.status, errorText);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Erreur API Claude',
            status: claudeResponse.status,
            details: errorText.substring(0, 500)
          })
        };
      }

      const aiData = await claudeResponse.json();
      const aiResponse = aiData.content[0].text;

      console.log(`✅ Success! Response length: ${aiResponse.length}`);

      const result = {
        response: aiResponse,
        source: 'claude-api',
        modelUsed: model,
        responseLength: aiResponse.length,
        timestamp: new Date().toISOString()
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };

    } catch (claudeError) {
      console.error('❌ Claude request failed:', claudeError.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Erreur lors de l\'appel à Claude',
          details: claudeError.message,
          timestamp: new Date().toISOString()
        })
      };
    }

  } catch (globalError) {
    console.error('💥 Global error:', globalError.message);
    console.error('Stack:', globalError.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur serveur interne',
        details: globalError.message,
        timestamp: new Date().toISOString(),
        function: 'ai-chat'
      })
    };
  }
};

// Fonctions d'analyse simplifiées
function analyzeUserRequest(message) {
  return {
    type: 'general',
    recommendations: {
      sections: ['header', 'hero', 'about', 'contact'],
      colors: ['#6B7280', '#3B82F6', '#10B981'],
      features: ['Présentation', 'Services', 'Contact']
    }
  };
}