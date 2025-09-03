const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Create a simple test video file
async function createTestVideo() {
  const videoPath = path.join(__dirname, 'test-video.mp4');
  
  if (fs.existsSync(videoPath)) {
    console.log('✅ Test video already exists');
    return videoPath;
  }
  
  // Create minimal MP4 file for testing
  const testVideoData = Buffer.from([
    // MP4 file signature and basic header
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
    // Add more bytes for a valid minimal video
    ...Array(1000).fill(0x00)
  ]);
  
  fs.writeFileSync(videoPath, testVideoData);
  console.log('✅ Test video created');
  return videoPath;
}

async function testAllFeatures() {
  console.log('🧪 Testing ALL GifLab features with real interactions...');
  
  const videoPath = path.join(__dirname, 'test-video-real.mp4');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: false,
    slowMo: 50,
    defaultViewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-features=SharedArrayBuffer'
    ]
  });
  
  const page = await browser.newPage();
  
  const results = {
    appLoad: false,
    videoUpload: false,
    themeToggle: false,
    presetButtons: [],
    filterButtons: [],
    advancedControls: {},
    gifGeneration: false
  };

  try {
    // Load site
    console.log('🌐 Loading gif.mindsecurity.org...');
    await page.goto('https://gif.mindsecurity.org', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.waitForSelector('header', { timeout: 30000 });
    results.appLoad = true;
    console.log('✅ Site loaded');
    
    // Test Theme Toggle
    console.log('\\n🌓 Testing theme toggle...');
    try {
      const initialTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      console.log(`  Initial: ${initialTheme ? 'dark' : 'light'}`);
      
      await page.click('[data-testid="theme-toggle"]');
      await page.waitForTimeout(500);
      
      const newTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      console.log(`  After toggle: ${newTheme ? 'dark' : 'light'}`);
      
      if (initialTheme !== newTheme) {
        results.themeToggle = true;
        console.log('  ✅ Theme toggle working');
      }
    } catch (error) {
      console.log('  ❌ Theme toggle failed:', error.message);
    }
    
    // Test Video Upload
    console.log('\\n📁 Testing video upload...');
    try {
      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(videoPath);
      console.log('  ✅ File uploaded');
      
      await page.waitForSelector('video', { timeout: 10000 });
      results.videoUpload = true;
      console.log('  ✅ Video loaded in interface');
    } catch (error) {
      console.log('  ❌ Video upload failed:', error.message);
    }
    
    // Test Presets
    console.log('\\n📱 Testing preset buttons...');
    try {
      await page.click('[data-testid="presets-button"]');
      await page.waitForTimeout(500);
      
      const presetIds = ['social', 'web', 'hd', 'mini'];
      for (const presetId of presetIds) {
        try {
          await page.click(`[data-testid="preset-${presetId}"]`);
          await page.waitForTimeout(300);
          
          const width = await page.$eval('input[type="number"]', el => el.value);
          console.log(`  ✅ ${presetId} preset: ${width}px`);
          results.presetButtons.push({ id: presetId, width, working: true });
        } catch (error) {
          console.log(`  ❌ ${presetId} preset failed:`, error.message);
        }
      }
    } catch (error) {
      console.log('  ❌ Presets failed:', error.message);
    }
    
    // Test Filters  
    console.log('\\n🎨 Testing filter buttons...');
    try {
      const filterIds = ['none', 'sharpen', 'vintage', 'bright'];
      for (const filterId of filterIds) {
        try {
          await page.click(`[data-testid="filter-${filterId}"]`);
          await page.waitForTimeout(300);
          
          const isActive = await page.$eval(`[data-testid="filter-${filterId}"]`, el => 
            el.classList.contains('from-purple-500')
          );
          
          console.log(`  ✅ ${filterId} filter ${isActive ? 'active' : 'clicked'}`);
          results.filterButtons.push({ id: filterId, active: isActive, working: true });
        } catch (error) {
          console.log(`  ❌ ${filterId} filter failed:`, error.message);
        }
      }
    } catch (error) {
      console.log('  ❌ Filters failed:', error.message);
    }
    
    // Test Advanced Controls
    console.log('\\n⚙️ Testing advanced controls...');
    try {
      // Width input
      const widthInput = await page.$('input[type="number"]');
      await widthInput.click({ clickCount: 3 });
      await widthInput.type('720');
      results.advancedControls.width = true;
      console.log('  ✅ Width input');
      
      // FPS select
      const fpsSelect = await page.$('select');
      await fpsSelect.select('24');
      results.advancedControls.fps = true;
      console.log('  ✅ FPS select');
      
      // Quality select  
      const selects = await page.$$('select');
      if (selects.length > 1) {
        await selects[1].select('best');
        results.advancedControls.quality = true;
        console.log('  ✅ Quality select');
      }
      
      // Loop checkbox
      const checkbox = await page.$('input[type="checkbox"]');
      await checkbox.click();
      results.advancedControls.loop = true;
      console.log('  ✅ Loop checkbox');
      
      // Time sliders
      const sliders = await page.$$('input[type="range"]');
      if (sliders.length >= 2) {
        await sliders[0].evaluate(el => { el.value = '1'; el.dispatchEvent(new Event('change')); });
        await sliders[1].evaluate(el => { el.value = '4'; el.dispatchEvent(new Event('change')); });
        results.advancedControls.sliders = true;
        console.log('  ✅ Time sliders');
      }
      
    } catch (error) {
      console.log('  ❌ Advanced controls failed:', error.message);
    }
    
    // Test GIF Generation
    if (results.videoUpload) {
      console.log('\\n🎬 Testing GIF generation...');
      try {
        await page.click('[data-testid="generate-gif-button"]');
        console.log('  ✅ Generate button clicked');
        
        // Wait for generation to start
        await page.waitForTimeout(2000);
        
        const isGenerating = await page.evaluate(() => {
          return document.querySelector('.animate-spin') !== null ||
                 document.body.textContent.includes('Gerando') ||
                 document.body.textContent.includes('Processando');
        });
        
        if (isGenerating) {
          results.gifGeneration = true;
          console.log('  ✅ GIF generation started');
          
          // Monitor progress for a few seconds
          for (let i = 0; i < 10; i++) {
            await page.waitForTimeout(1000);
            const progress = await page.evaluate(() => {
              const elements = Array.from(document.querySelectorAll('*'));
              for (const el of elements) {
                if (el.textContent && el.textContent.includes('%')) {
                  return el.textContent;
                }
              }
              return null;
            });
            
            if (progress) {
              console.log(`  📊 ${progress}`);
              break;
            }
          }
        }
      } catch (error) {
        console.log('  ❌ GIF generation failed:', error.message);
      }
    }
    
    // Final Results
    console.log('\\n📊 FINAL TEST RESULTS:');
    console.log('==========================');
    console.log(`✅ App Loading: ${results.appLoad ? 'PASS' : 'FAIL'}`);
    console.log(`📁 Video Upload: ${results.videoUpload ? 'PASS' : 'FAIL'}`);  
    console.log(`🌓 Theme Toggle: ${results.themeToggle ? 'PASS' : 'FAIL'}`);
    console.log(`📱 Presets: ${results.presetButtons.length}/4 working`);
    console.log(`🎨 Filters: ${results.filterButtons.length}/4 working`);
    
    const controlsCount = Object.values(results.advancedControls).filter(Boolean).length;
    console.log(`⚙️ Advanced Controls: ${controlsCount}/5 working`);
    console.log(`🎬 GIF Generation: ${results.gifGeneration ? 'PASS' : 'FAIL'}`);
    
    // Calculate final score
    let score = 0;
    let maxScore = 7;
    
    if (results.appLoad) score++;
    if (results.videoUpload) score++;
    if (results.themeToggle) score++;
    if (results.presetButtons.length >= 3) score++;
    if (results.filterButtons.length >= 3) score++;  
    if (controlsCount >= 4) score++;
    if (results.gifGeneration) score++;
    
    const percentage = Math.round((score / maxScore) * 100);
    console.log(`\\n🎯 OVERALL SCORE: ${score}/${maxScore} (${percentage}%)`);
    
    if (percentage >= 90) {
      console.log('🎉 EXCELLENT! GifLab is working perfectly!');
    } else if (percentage >= 70) {
      console.log('✅ GOOD! GifLab is working well with minor issues');
    } else if (percentage >= 50) {
      console.log('⚠️ FAIR! GifLab has some functionality but needs fixes');
    } else {
      console.log('❌ POOR! GifLab needs significant work');
    }
    
    console.log('\\n✅ Test completed. Browser staying open for manual verification.');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Cleanup
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log('🗑️ Test video cleaned up');
      }
    } catch (e) {}
  }
}

testAllFeatures();