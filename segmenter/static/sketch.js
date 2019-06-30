"use strict";
 
let original_img, img, g, slic_img, segmented, bg, default_bg, hover, segmask, fname='image';

let drawing_mode = 1, drawing = false;

let show_img = false;
let show_g = false;
let show_slic = false;
let show_segmented = false;

let prev_mouseX = 0;
let prev_mouseY = 0;

function failure(response){
  console.log('Failed', response);
}

function draggedOver(evt){
  bg = hover;
  evt.preventDefault();
}

function dragLeft(evt){
  bg = default_bg;
  evt.preventDefault();
}

function gotFile(f) {
  if(f.type === 'image'){
    fname = f.name;
  	img = loadImage(f.data, onImageLoad);
  }
  else{
  	print(`"${f.name}" isn't an image file!`);
  }
}

function onImageLoad(img){
	let w = 500
	let h = img.height * 500 / img.width;
  
  resizeCanvas(w, h);
  g = createGraphics(w, h);
  g.background(0,0,0,50);

  original_img = createImage(img.width, img.height);
  original_img.copy(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
  img.resize(w, h);
  
  img.loadPixels();
	let data = {
		width: img.width,
		height: img.height,
		pixels: img.pixels
	}
  httpPost('get_slic', 'json', data, got_slic, failure);
  
  show_img = true;
  show_g = false;
  show_slic = false;
  show_segmented = false;

  slic_img = createImage(w, h);
  segmented = createImage(w, h);
  segmask = createImage(w, h);
}

function got_slic(response){
  slic_img.loadPixels();
	for (var i = slic_img.pixels.length - 1; i >= 0; i--) {
		slic_img.pixels[i] = response.image[i];
	}
  slic_img.updatePixels();

  show_img = false;
  show_g = false;
  show_slic = true;
  show_segmented = false;
}

function got_segmask(response){
  segmented.loadPixels();
	for (var i = segmented.pixels.length - 1; i >= 0; i--) {
    segmented.pixels[i] = response.image[i];
	}
  segmented.updatePixels();

  segmask.loadPixels();
	for (var i = segmask.pixels.length - 1; i >= 0; i--) {
    segmask.pixels[i] = response.segmask[i];
	}
  segmask.updatePixels();
  
  show_img = false;
  show_g = false;
  show_slic = false;
  show_segmented = true;
}

function drawing_foreground(){
  drawing_mode = 1;
  console.log('drawing foreground');

  show_img = false;
  show_g = true;
  show_slic = true;
}

function drawing_background(){
  drawing_mode = 2;
  console.log('drawing background');

  show_img = false;
  show_g = true;
  show_slic = true;
}

function start_drawing(){
  prev_mouseX = mouseX;
  prev_mouseY = mouseY;
  drawing = true;
  console.log('pressed');
}

function stop_drawing(){
  drawing = false;
  console.log('released');
}

function segment(){
  g.loadPixels();
  img.loadPixels();
  let data = {
		width: img.width,
		height: img.height,
    pixels: img.pixels,
    marking_pixels: g.pixels
	}
	httpPost('segment', 'json', data, got_segmask, failure);
}

function save_segmask(){
  let upscaled_segmask = createImage(img.width, img.height);
  upscaled_segmask.copy(segmask, 0, 0, img.width, img.height, 0, 0, img.width, img.height);
  upscaled_segmask.resize(original_img.width, original_img.height);
  upscaled_segmask.save(fname+'_segmask', 'jpg');
}
 
function setup() {
  let c = createCanvas(500, 500).parent('canvasHolder');
  c.drop(gotFile);
  c.dragOver(draggedOver);
  c.dragLeave(dragLeft);

  g = createGraphics(500, 500);
  g.background(0,0,0,50);

  c.mousePressed(start_drawing);
  c.mouseReleased(stop_drawing);
 
  textAlign(CENTER).textSize(24);
  colorMode(RGB).imageMode(CORNER);
  fill(200).noStroke();
 
  default_bg = color(51);
  hover = color(200);
  bg = default_bg;

  let foreground_button = createButton('Foreground');
  foreground_button.parent('fields');
  foreground_button.mousePressed(drawing_foreground);
  foreground_button.class('btn btn-danger');

  let background_button = createButton('Background');
  background_button.parent('fields');
  background_button.mousePressed(drawing_background);
  background_button.class('btn btn-primary');

  let segment_button = createButton('Segment');
  segment_button.parent('fields');
  segment_button.mousePressed(segment);
  segment_button.class('btn btn-warning');

  let save_segmask_button = createButton('Save');
  save_segmask_button.parent('fields');
  save_segmask_button.mousePressed(save_segmask);
  save_segmask_button.class('btn btn-info');

  let match_button = createButton('Match');
  match_button.parent('fields');
  match_button.mousePressed(match);
  match_button.class('btn btn-success');
}
 
function draw() {
  background(bg);
 
  if (show_img){
  	image(img, 0, 0, width, height);
  }
  else{
  	text('Drag an image file onto this area.', width>>1, height>>1);
  }
  if(show_slic){
    image(slic_img, 0, 0, width, height);
  }
  if(show_segmented){
    image(segmented, 0, 0, width, height);
  }
  

  if(drawing){
    if(drawing_mode == 1){
      g.stroke(255, 0, 0);
      g.strokeWeight(10);
      g.line(prev_mouseX, prev_mouseY, mouseX, mouseY);
      prev_mouseX = mouseX;
      prev_mouseY = mouseY;
    }
    if(drawing_mode == 2){
      g.stroke(0,0,255);
      g.strokeWeight(10);
      g.line(prev_mouseX, prev_mouseY, mouseX, mouseY);
      prev_mouseX = mouseX;
      prev_mouseY = mouseY;
    }
  }

  if(show_g){
    image(g, 0, 0);
  }
}