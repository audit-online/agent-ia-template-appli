// netlify/functions/ai-chat.js
exports.handler = async (event, context) => {
  console.log('🚀 Fonction ai-chat appelée');
  console.log('Method:', event.httpMethod);
  console.log('Headers:', event.headers);

  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
  };

  // Gérer les requêtes OPTIONS (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    console.log('📋 Requête OPTIONS reçue');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS OK' })
    };
  }

  // Test GET pour vérifier que la fonction fonctionne
  if (event.httpMethod === 'GET') {
    console.log('📋 Requête GET de test');
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

  // Vérifier la méthode HTTP
  if (event.httpMethod !== 'POST') {
    console.log('❌ Méthode non autorisée:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('📝 Body reçu:', event.body);

    // Vérifier la clé API
    if (!process.env.ANTHROPIC_KEY) {
      console.error('❌ ANTHROPIC_KEY non configurée');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Configuration manquante',
          details: 'ANTHROPIC_KEY non définie dans les variables d\'environnement Netlify'
        })
      };
    }

    console.log('✅ ANTHROPIC_KEY présente');

    // Parser le body
    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body || '{}');
    } catch (e) {
      console.error('❌ Erreur parsing JSON:', e);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'JSON invalide' })
      };
    }

    const { message, systemPrompt } = parsedBody;
    
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message requis' })
      };
    }

    console.log('📤 Envoi vers Claude API...');

    // Appel à l'API Claude
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt || 'Tu es un assistant IA spécialisé dans la création de sites web.'}\n\nMessage utilisateur: ${message}`
          }
        ]
      })
    });

    console.log('📥 Statut réponse Claude:', claudeResponse.status);

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('❌ Erreur API Claude:', claudeResponse.status, errorText);
      return {
        statusCode: claudeResponse.status,
        headers,
        body: JSON.stringify({ 
          error: `Erreur API Claude: ${claudeResponse.status}`,
          details: errorText
        })
      };
    }

    const aiData = await claudeResponse.json();
    console.log('✅ Réponse Claude reçue');

    const aiResponse = aiData.content[0].text;

    // Analyse intelligente
    const analysis = analyzeUserRequest(message);

    console.log('🎯 Type détecté:', analysis.type);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        response: aiResponse,
        detectedType: analysis.type,
        recommendations: analysis.recommendations,
        source: 'claude-api',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('💥 Erreur dans ai-chat:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur serveur interne',
        details: error.message,
        stack: error.stack
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