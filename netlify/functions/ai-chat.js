exports.handler = async (event, context) => {
  // Vérifier la méthode HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { message, systemPrompt } = JSON.parse(event.body);
    
    // Appel à l'API Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
            content: `${systemPrompt}\n\nMessage utilisateur: ${message}`
          }
        ]
      })
    });

    const aiData = await response.json();
    const aiResponse = aiData.content[0].text;

    // Analyse intelligente
    const analysis = analyzeUserRequest(message);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        response: aiResponse,
        detectedType: analysis.type,
        recommendations: analysis.recommendations
      })
    };

  } catch (error) {
    console.error('Erreur IA:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Erreur serveur: ' + error.message })
    };
  }
};

// Fonction d'analyse intelligente
function analyzeUserRequest(message) {
  const keywords = {
    restaurant: ['restaurant', 'café', 'food', 'menu', 'cuisine', 'chef', 'plat'],
    ecommerce: ['boutique', 'vente', 'produit', 'commerce', 'shop', 'magasin'],
    portfolio: ['portfolio', 'artiste', 'photo', 'design', 'créatif'],
    business: ['entreprise', 'service', 'consulting', 'agence', 'bureau']
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
    restaurant: ['header', 'hero', 'menu', 'about', 'contact', 'gallery'],
    ecommerce: ['header', 'hero', 'products', 'cart', 'checkout'],
    portfolio: ['header', 'hero', 'projects', 'about', 'skills', 'contact'],
    business: ['header', 'hero', 'services', 'about', 'team', 'contact']
  };
  return sectionMap[type] || ['header', 'hero', 'about', 'contact'];
}

function getColorsForType(type) {
  const colorMap = {
    restaurant: ['#8B4513', '#DAA520', '#CD853F'],
    ecommerce: ['#2563EB', '#DC2626', '#059669'],
    portfolio: ['#7C3AED', '#EC4899', '#F59E0B'],
    business: ['#1F2937', '#3B82F6', '#10B981']
  };
  return colorMap[type] || ['#6B7280', '#3B82F6', '#10B981'];
}

function getFeaturesForType(type) {
  const featureMap = {
    restaurant: ['Menu en ligne', 'Réservations', 'Galerie photos'],
    ecommerce: ['Catalogue produits', 'Panier', 'Paiement'],
    portfolio: ['Galerie projets', 'CV en ligne', 'Contact'],
    business: ['Services', 'Équipe', 'Témoignages']
  };
  return featureMap[type] || ['Présentation', 'Services', 'Contact'];
}