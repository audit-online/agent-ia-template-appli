// netlify/functions/ai-chat.js - Version avec debugging amélioré
exports.handler = async (event, context) => {
  console.log('🚀 Fonction ai-chat appelée');
  console.log('📝 Headers:', JSON.stringify(event.headers, null, 2));
  console.log('📦 Body:', event.body);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS OK' }) };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: 'Fonction ai-chat opérationnelle!',
        timestamp: new Date().toISOString(),
        hasAnthropicKey: !!process.env.ANTHROPIC_KEY,
        keyLength: process.env.ANTHROPIC_KEY ? process.env.ANTHROPIC_KEY.length : 0
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    if (!process.env.ANTHROPIC_KEY) {
      console.error('❌ ANTHROPIC_KEY manquante');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Configuration manquante',
          details: 'ANTHROPIC_KEY non définie',
          help: 'Vérifiez les variables d\'environnement Netlify'
        })
      };
    }

    let requestData;
    try {
      requestData = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('❌ Erreur parsing JSON:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'JSON invalide',
          details: parseError.message
        })
      };
    }

    const { message, systemPrompt, conversationHistory, context } = requestData;
    
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message requis' })
      };
    }

    console.log('📨 Message reçu:', message.substring(0, 100));
    console.log('💬 Historique longueur:', conversationHistory?.length || 0);

    // Liste des modèles à essayer par ordre de préférence
    const modelsToTry = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620', 
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];

    let lastError = null;
    
    // Essayer chaque modèle jusqu'à ce qu'un fonctionne
    for (const model of modelsToTry) {
      try {
        console.log(`🔄 Essai du modèle: ${model}`);
        
        // Construction du prompt plus robuste
        let finalPrompt;
        if (conversationHistory && conversationHistory.length > 0) {
          finalPrompt = `${systemPrompt}\n\nVoici notre conversation complète jusqu'à présent:\n${JSON.stringify(conversationHistory, null, 2)}\n\nRéponds en tenant compte de TOUT cet historique. Ton dernier message doit être cohérent avec tout ce qui a été dit précédemment.`;
        } else {
          finalPrompt = `${systemPrompt || 'Tu es un assistant IA spécialisé dans la création de sites web.'}\n\nMessage utilisateur: ${message}`;
        }

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 8000,
            temperature: 0.8,
            messages: [
              {
                role: 'user',
                content: finalPrompt
              }
            ]
          })
        });

        console.log(`📡 Réponse Claude status: ${claudeResponse.status}`);

        if (claudeResponse.ok) {
          const aiData = await claudeResponse.json();
          const aiResponse = aiData.content[0].text;
          const analysis = analyzeUserRequest(message);

          console.log(`✅ Succès avec le modèle: ${model}`);
          console.log(`📏 Longueur de la réponse: ${aiResponse.length} caractères`);
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              response: aiResponse,
              detectedType: analysis.type,
              recommendations: analysis.recommendations,
              source: 'claude-api',
              modelUsed: model,
              responseLength: aiResponse.length,
              timestamp: new Date().toISOString(),
              conversationContext: context || null
            })
          };
        } else {
          const errorText = await claudeResponse.text();
          lastError = `${model}: ${claudeResponse.status} - ${errorText}`;
          console.log(`❌ Échec avec ${model}:`, lastError);
        }
        
      } catch (error) {
        lastError = `${model}: ${error.message}`;
        console.log(`❌ Erreur avec ${model}:`, error.message);
        console.error('Stack trace:', error.stack);
      }
    }

    // Si aucun modèle n'a fonctionné
    console.error('💥 Tous les modèles ont échoué');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Tous les modèles Claude ont échoué',
        details: lastError,
        modelsAttempted: modelsToTry,
        troubleshooting: {
          step1: 'Vérifiez la clé API Anthropic',
          step2: 'Vérifiez les logs Netlify',
          step3: 'Testez avec curl directement'
        }
      })
    };

  } catch (error) {
    console.error('💥 Erreur générale:', error);
    console.error('Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur serveur interne',
        details: error.message,
        stack: error.stack?.split('\n').slice(0, 3) // Première ligne de la stack
      })
    };
  }
};

// Fonction d'analyse intelligente
function analyzeUserRequest(message) {
  const keywords = {
    restaurant: ['restaurant', 'café', 'food', 'menu', 'cuisine', 'chef', 'plat', 'gastronomie'],
    ecommerce: ['boutique', 'vente', 'produit', 'commerce', 'shop', 'magasin', 'e-commerce'],
    portfolio: ['portfolio', 'artiste', 'photo', 'design', 'créatif', 'photographe'],
    business: ['entreprise', 'service', 'consulting', 'agence', 'bureau', 'société'],
    blog: ['blog', 'article', 'contenu', 'magazine', 'actualité'],
    landing: ['landing', 'conversion', 'campagne', 'marketing', 'promotion']
  };

  let detectedType = null;
  let maxScore = 0;

  Object.entries(keywords).forEach(([type, words]) => {
    const score = words.filter(word => 
      message.toLowerCase().includes(word)
    ).length;
    
    if (score > maxScore) {
      maxScore = score;
      detectedType = type;
    }
  });

  return {
    type: detectedType,
    recommendations: {
      sections: getSectionsForType(detectedType),
      colors: getColorsForType(detectedType),
      features: getFeaturesForType(detectedType)
    }
  };
}

function getSectionsForType(type) {
  const sectionMap = {
    restaurant: ['header', 'hero', 'menu', 'about', 'contact', 'gallery', 'testimonials'],
    ecommerce: ['header', 'hero', 'products', 'categories', 'cart', 'checkout', 'testimonials'],
    portfolio: ['header', 'hero', 'projects', 'about', 'skills', 'contact', 'testimonials'],
    business: ['header', 'hero', 'services', 'about', 'team', 'contact', 'pricing'],
    blog: ['header', 'hero', 'articles', 'categories', 'sidebar', 'contact', 'newsletter'],
    landing: ['header', 'hero', 'features', 'benefits', 'testimonials', 'pricing', 'cta']
  };
  return sectionMap[type] || ['header', 'hero', 'about', 'contact'];
}

function getColorsForType(type) {
  const colorMap = {
    restaurant: ['#8B4513', '#DAA520', '#CD853F'],
    ecommerce: ['#2563EB', '#DC2626', '#059669'],
    portfolio: ['#7C3AED', '#EC4899', '#F59E0B'],
    business: ['#1F2937', '#3B82F6', '#10B981'],
    blog: ['#6366F1', '#8B5CF6', '#EC4899'],
    landing: ['#EF4444', '#F97316', '#EAB308']
  };
  return colorMap[type] || ['#6B7280', '#3B82F6', '#10B981'];
}

function getFeaturesForType(type) {
  const featureMap = {
    restaurant: ['Menu en ligne', 'Réservations', 'Galerie photos', 'Avis clients'],
    ecommerce: ['Catalogue produits', 'Panier d\'achat', 'Paiement sécurisé', 'Gestion commandes'],
    portfolio: ['Galerie projets', 'CV téléchargeable', 'Formulaire contact', 'Témoignages'],
    business: ['Présentation services', 'Équipe', 'Témoignages clients', 'Devis en ligne'],
    blog: ['Système d\'articles', 'Catégories', 'Recherche', 'Newsletter'],
    landing: ['Call-to-action', 'Formulaire capture', 'Témoignages', 'Garanties']
  };
  return featureMap[type] || ['Présentation', 'Services', 'Contact'];
}