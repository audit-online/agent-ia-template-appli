// netlify/functions/ai-chat.js - Version avec plus de tokens et mémoire complète
exports.handler = async (event, context) => {
  console.log('🚀 Fonction ai-chat appelée');

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
        hasAnthropicKey: !!process.env.ANTHROPIC_KEY
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
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Configuration manquante',
          details: 'ANTHROPIC_KEY non définie'
        })
      };
    }

    const { message, systemPrompt, conversationHistory, context } = JSON.parse(event.body || '{}');
    
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message requis' })
      };
    }

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
            messages: conversationHistory && conversationHistory.length > 0 ? [
              {
                role: 'system',
                content: systemPrompt || 'Tu es un assistant IA spécialisé dans la création de sites web.'
              },
              ...conversationHistory
            ] : [
              {
                role: 'user',
                content: `${systemPrompt || 'Tu es un assistant IA spécialisé dans la création de sites web.'}\n\nMessage utilisateur: ${message}`
              }
            ]
          })
        });

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
      }
    }

    // Si aucun modèle n'a fonctionné
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Tous les modèles Claude ont échoué',
        details: lastError,
        modelsAttempted: modelsToTry
      })
    };

  } catch (error) {
    console.error('💥 Erreur générale:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur serveur interne',
        details: error.message
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