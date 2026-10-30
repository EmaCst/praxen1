import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  build:{outDir:'dist',sourcemap:false},
  plugins:[{
    name:'praxen-brand-assets',
    closeBundle(){
      const source=resolve('praxen-icon.png');
      const target=resolve('dist/praxen-icon.png');
      if(existsSync(source)){mkdirSync(resolve('dist'),{recursive:true});copyFileSync(source,target);}
    }
  }]
});
