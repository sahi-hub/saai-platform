/**
 * Speed Test for All LLM Providers
 * Tests: groq, gemini, or_gptoss, or_gemma, or_llama, openrouter
 */

require('dotenv').config();

const groqProvider = require('./src/llm/providers/groqProvider');
const geminiProvider = require('./src/llm/providers/geminiProvider');
const openRouterProvider = require('./src/llm/providers/openRouterProvider');
const openRouterGptOssProvider = require('./src/llm/providers/openRouterGptOssProvider');
const openRouterGemmaProvider = require('./src/llm/providers/openRouterGemmaProvider');
const openRouterLlamaProvider = require('./src/llm/providers/openRouterLlamaProvider');

const providers = {
  groq: groqProvider,
  gemini: geminiProvider,
  or_gptoss: openRouterGptOssProvider,
  or_gemma: openRouterGemmaProvider,
  or_llama: openRouterLlamaProvider,
  openrouter: openRouterProvider,
};

const TEST_MESSAGES = [
  { role: 'user', content: 'Say "Hello World" and nothing else.' }
];

async function testProvider(name, provider) {
  const results = [];
  const attempts = 3;
  
  console.log(`\nTesting ${name}...`);
  
  for (let i = 0; i < attempts; i++) {
    try {
      const start = Date.now();
      const response = await provider.callPlain(TEST_MESSAGES);
      const duration = Date.now() - start;
      
      // Handle response object (providers return {success, text, ...})
      if (response?.success) {
        results.push({ success: true, duration, response: response.text?.substring(0, 50) });
        console.log(`  Attempt ${i + 1}: ${duration}ms ✓`);
      } else {
        results.push({ success: false, duration: null, error: response?.error || 'Unknown error' });
        console.log(`  Attempt ${i + 1}: FAILED - ${response?.error || 'Unknown error'}`);
      }
    } catch (error) {
      results.push({ success: false, duration: null, error: error.message });
      console.log(`  Attempt ${i + 1}: FAILED - ${error.message}`);
    }
    // Small delay between attempts to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const successful = results.filter(r => r.success);
  const avgTime = successful.length > 0 
    ? Math.round(successful.reduce((a, b) => a + b.duration, 0) / successful.length)
    : null;
  const minTime = successful.length > 0 
    ? Math.min(...successful.map(r => r.duration))
    : null;
  const maxTime = successful.length > 0 
    ? Math.max(...successful.map(r => r.duration))
    : null;
    
  return {
    name,
    attempts,
    successes: successful.length,
    avgTime,
    minTime,
    maxTime,
    successRate: `${Math.round((successful.length / attempts) * 100)}%`
  };
}

async function runSpeedTests() {
  console.log('='.repeat(60));
  console.log('LLM Provider Speed Test');
  console.log('='.repeat(60));
  console.log(`Test prompt: "${TEST_MESSAGES[0].content}"`);
  console.log(`Attempts per provider: 3`);
  
  const results = [];
  
  for (const [name, provider] of Object.entries(providers)) {
    const result = await testProvider(name, provider);
    results.push(result);
    // Delay between providers
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Sort by average time (fastest first), null values at end
  results.sort((a, b) => {
    if (a.avgTime === null) return 1;
    if (b.avgTime === null) return -1;
    return a.avgTime - b.avgTime;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS (sorted by speed, fastest first)');
  console.log('='.repeat(60));
  console.log('\n| Provider    | Avg (ms) | Min (ms) | Max (ms) | Success |');
  console.log('|-------------|----------|----------|----------|---------|');
  
  for (const r of results) {
    const avg = r.avgTime !== null ? r.avgTime.toString().padStart(6) : '  FAIL';
    const min = r.minTime !== null ? r.minTime.toString().padStart(6) : '     -';
    const max = r.maxTime !== null ? r.maxTime.toString().padStart(6) : '     -';
    const name = r.name.padEnd(11);
    console.log(`| ${name} | ${avg}   | ${min}   | ${max}   | ${r.successRate.padStart(7)} |`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDED PRIORITY ORDER:');
  console.log('='.repeat(60));
  
  // Only include working providers
  const workingProviders = results.filter(r => r.avgTime !== null).map(r => r.name);
  workingProviders.push('mock'); // Always add mock at the end
  
  console.log(`\nLLM_PRIORITY=${workingProviders.join(',')}`);
  console.log(`\nDEFAULT_PRIORITY = ['${workingProviders.join("', '")}'];`);
}

runSpeedTests().catch(console.error);
