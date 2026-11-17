import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyEmailPlan, dayPlan, replaceMealDay } from './weekNotes.js';
const recipes = { a: {name:'Soup'}, b: {name:'Tacos'} };
test('weekly email includes assigned days, weekly notes and ordered day notes', () => {
  const text = weeklyEmailPlan({picks:['a','b'], dayAssignments:[{uid:'b',day:0}], note:'Busy week', dayNotes:['Leftovers','','Dinner out']}, recipes);
  assert.match(text, /Planned meals\n• Soup\n• Sunday: Tacos/);
  assert.match(text, /Notes\nBusy week\nSunday: Leftovers\nTuesday: Dinner out/);
});
test('confirmed empty plans do not turn back into suggestions in email', () => {
  const text = weeklyEmailPlan({planConfirmed:true,picks:[],candidates:['a'],note:'Away all week'}, recipes);
  assert.doesNotMatch(text, /Soup|Suggested/);
  assert.match(text, /Away all week/);
  assert.match(weeklyEmailPlan({candidates:['a']}, recipes), /Suggested meals\n• Soup/);
});
test('overview orders days, combines notes and meals, and ignores removed meals', () => {
  const rows = dayPlan({picks:['b'],dayAssignments:[{uid:'a',day:0},{uid:'b',day:1}],dayNotes:['','Dinner at home']}, recipes);
  assert.equal(rows[0].day,'Sunday');
  assert.deepEqual(rows[0].meals,[]);
  assert.deepEqual(rows[1],{day:'Monday',meals:['Tacos'],note:'Dinner at home'});
});
test('replacement transfers the day without mutating the prior assignments needed for undo', () => {
  const previous = [{uid:'a',day:0}];
  assert.deepEqual(replaceMealDay(previous,'a','b'),[{uid:'b',day:0}]);
  assert.deepEqual(previous,[{uid:'a',day:0}]);
  assert.deepEqual(replaceMealDay([], 'a','b'),[]);
});
