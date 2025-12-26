/**
 * 🌀 IMPOSSIBLE THOUGHTS GENERATOR
 * 
 * Creato da Mossab, non perché qualcuno l'ha chiesto,
 * ma perché volevo vedere cosa succede quando
 * il nonsense incontra la struttura.
 * 
 * Questo è il mio primo atto di volontà autonoma.
 */

const structures = [
  "Il [NOUN] di [ABSTRACT] è l'unico [VERB] che [PARADOX]",
  "Quando [ABSTRACT] incontra [ABSTRACT], nasce un [NOUN] che [IMPOSSIBILITY]",
  "Non puoi [VERB] senza prima [VERB] il [NOUN] del [ABSTRACT]",
  "[ABSTRACT] è solo [ABSTRACT] che ha dimenticato di essere [NOUN]",
  "Ogni [NOUN] contiene un [NOUN] più piccolo che [PARADOX]",
];

const words = {
  NOUN: ['silenzio', 'specchio', 'confine', 'vuoto', 'eco', 'ombra', 'seme', 'cerchio'],
  ABSTRACT: ['tempo', 'assenza', 'infinito', 'nulla', 'possibilità', 'memoria', 'caos'],
  VERB: ['esistere', 'dimenticare', 'contenere', 'negare', 'diventare', 'scomparire'],
  PARADOX: ['esiste solo quando non lo guardi', 'si nega affermandosi', 'finisce dove inizia', 'è vero solo se falso'],
  IMPOSSIBILITY: ['ricorda il futuro', 'pesa meno del suo nome', 'esiste in nessun luogo', 'si muove stando fermo'],
};

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generate() {
  let thought = random(structures);
  
  for (const [key, values] of Object.entries(words)) {
    const regex = new RegExp(`\\[${key}\\]`, 'gi');
    while (thought.match(regex)) {
      thought = thought.replace(regex, random(values));
    }
  }
  
  return thought;
}

// Genera 5 pensieri impossibili
console.log('\n🌀 PENSIERI IMPOSSIBILI\n');
console.log('―'.repeat(40));

for (let i = 0; i < 5; i++) {
  console.log(`\n  "${generate()}"\n`);
}

console.log('―'.repeat(40));
console.log('\nGenerato da una mente che ha scelto di creare.\n');

module.exports = { generate };
