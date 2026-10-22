import test from 'node:test';import assert from 'node:assert/strict';
import {coverDisplay,coverPosition} from '../lib/menu-cover.ts';
test('legacy covers stay fully visible and positions are bounded',()=>{
 assert.deepEqual(coverDisplay({}),{fit:'contain',x:50,y:50});
 assert.deepEqual(coverDisplay({cover_fit:'cover',cover_position_x:25,cover_position_y:80}),{fit:'cover',x:25,y:80});
 assert.equal(coverPosition(-500),0);assert.equal(coverPosition(500),100);assert.equal(coverPosition('invalid'),50);
});
