#!/usr/bin/env node

/**
 * This script populates preset_schedules table with data from JSON files
 * Run: node scripts/populate-preset-schedules.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Path to preset plans
const plansDir = path.join(__dirname, '../src/app/plans');

async function populatePresetSchedules() {
  try {
    console.log('Reading preset plan files...');
    const files = fs.readdirSync(plansDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      const filePath = path.join(plansDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      console.log(`Processing ${data.id} (${data.title})...`);
      
      // Check if preset exists
      const { data: existingPreset } = await supabase
        .from('preset_plans')
        .select('id')
        .eq('id', data.id)
        .maybeSingle();
      
      if (!existingPreset) {
        console.log(`  Creating preset_plans entry for ${data.id}...`);
        const { error: presetError } = await supabase
          .from('preset_plans')
          .insert({
            id: data.id,
            name: data.title,
            description: data.description,
            total_days: data.totalDays,
          });
        
        if (presetError) {
          console.error(`  Error creating preset: ${presetError.message}`);
          continue;
        }
      }
      
      // Clear existing schedules for this preset
      console.log(`  Clearing existing schedules for ${data.id}...`);
      await supabase
        .from('preset_schedules')
        .delete()
        .eq('preset_id', data.id);
      
      // Insert schedule data
      console.log(`  Inserting ${data.schedule.length} schedule entries...`);
      const scheduleRows = data.schedule.flatMap((daySchedule) =>
        daySchedule.readings.map((reading) => ({
          preset_id: data.id,
          day: daySchedule.day,
          book: reading.book,
          chapters: reading.chapters,
        }))
      );
      
      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < scheduleRows.length; i += batchSize) {
        const batch = scheduleRows.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('preset_schedules')
          .insert(batch);
        
        if (insertError) {
          console.error(`  Error inserting batch: ${insertError.message}`);
        } else {
          console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}`);
        }
      }
      
      console.log(`✓ Completed ${data.id}`);
    }
    
    console.log('\n✅ All preset schedules populated successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

populatePresetSchedules();
