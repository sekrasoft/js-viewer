(function module(){
'use strict';

var SEC = 1000;

/**
 * параметры просмотрщика
 */
var parameters = {
  
  /////////////////////
  // ПАРАМЕТРЫ ЗАГРУЗКИ
  
  // Время между попытками повторной загрузки картинки/списка картинок
  RELOAD_TIMEOUT: 5 * SEC,
  // Количество изображений, загружающихся одновременно по умолчанию
  // Просмотрщик может регулировать количество изображений
  DEFAULT_IMAGES_PER_TIME: 2,
  // Максимальное количество одновременно загружаемых изображений
  MAX_IMAGES_PER_TIME: 5,
  // Максимальное количество подгружаемых изображений после текущего
  MAX_FORWARD_IMAGES: 50,
  // Максимальное количество подгружаемых изображений до текущего
  MAX_BACKWARD_IMAGES: 10,
  // Регулярное выражение для расширений файлов с картинками
  EXTENSIONS_RE: /(\.jpg|\.png|\.gif|\.jpeg)$/i,

  ////////////////////////
  // ПАРАМЕТРЫ ОТОБРАЖЕНИЯ
  
  // Длительность показа картинки в слайдшоу по умолчанию (в секундах)
  DEFAULT_SLIDESHOW_DELAY: 1 * SEC,
  // Период обновления списка картинок по умолчанию (в секундах)
  // Малое значение удобно для случая, когда картинки добавляются динамически,
  // например, выкладываются в реальном времени во время некоторого мероприятия
  DEFAULT_LIST_UPDATE_DELAY: 120 * SEC,
  // Коэффициент увеличения/уменьшения картинки при нажатии на "+"/"-"
  ZOOM_SCALE_RATIO: 1.3,
  
  /////////////////////
  // ПАРАМЕТРЫ ЭВРИСТИК
  
  // Параметр затухания статистики загрузки изображений
  // Данные о скольки последних загруженных изображений использовать для расчёта
  // среднего времени загрузки
  LOAD_TIME_ACCOUNT_FOR_IMAGES: 6.6,
  // Параметр затухания статистики задержке между загрузками изображений
  // Данные о скольки последних загруженных изображений использовать для расчёта
  // времени между загрузками изображений
  LOAD_DELAY_ACCOUNT_FOR_IMAGES: 4,
  // Предсказанное значение времени между загрузками изображений для первого
  // изображения
  FIRST_LOAD_DELAY: 10 * SEC,
  // Максимальное среднее время задержки между загрузками последних изображений,
  // при увеличении которого эвристика задумывается о загрузке большего
  // числа изображений одновременно
  MAX_LAST_LOAD_DELAY: 0.3 * SEC, // для загрузки следующих изображений
  MAX_LAST_LOAD_DELAY2: 0.5 * SEC, // для загрузки предыдыщих изображений
  // Минимальное среднее время загрузки загрузками последних изображений,
  // при уменьшении которого эвристика задумывается о загрузке большего
  // числа изображений одновременно
  MIN_LAST_LOAD_TIME: 1 * SEC, // для загрузки следующих изображений
  MIN_LAST_LOAD_TIME2: 1 * SEC, // для загрузки предыдыщих изображений
  // Максимальное среднее время загрузки загрузками последних изображений,
  // при увеличении которого эвристика задумывается о загрузке меньшего
  // числа изображений одновременно
  MAX_LAST_LOAD_TIME: 5 * SEC, // для загрузки следующих изображений
  MAX_LAST_LOAD_TIME2: 5 * SEC, // для загрузки предыдыщих изображений
  // Коэффициент увеличения количества изображений для загрузки
  // K: N_new = (N+1)*K
  LOADING_INC_RATIO: 1.3, // для загрузки следующих изображений
  LOADING_INC_RATIO2: 1.1, // для загрузки предыдыщих изображений
  // Коэффициент уменьшения количества изображений для загрузки
  // K: N_new = N/K-1
  LOADING_DEC_RATIO: 1.5, // для загрузки следующих изображений
  LOADING_DEC_RATIO2: 1.5 // для загрузки предыдыщих изображений
};

// old ECMAScript --------------------------------------------------------------

if(!Array.prototype.forEach) Array.prototype.forEach = function(f){
  for(var i=0; i<this.length; ++i) f(this[i], i, this);
};

if(!Array.prototype.map) Array.prototype.map = function(f){
  var arr = Array(this.length);
  for(var i=0; i<this.length; ++i) arr[i] = f(this[i], i, this);
  return arr;
};

if(!Array.prototype.filter) Array.prototype.filter = function(f){
  var arr = [];
  for(var i=0; i<this.length; ++i)
    if(f(this[i], i, this)) arr.push(this[i]);
  return arr;
};

if(!window.localStorage) window.localStorage = {
  getItem: function(name){ return this[name]; },
  setItem: function(name, value){ return this[name] = String(value); },
  removeItem: function(name){ this[name] = ''; }
};

if(!window.console) window.console = {log: function(a){}};

// helpers ---------------------------------------------------------------------

function getElement(className, parent) {
  var es = (parent ? parent : document).getElementsByClassName(className);
  if(!es || !es.length) return null;
  return es[0];
}

function getElements(className, parent) {
  return toArray((parent ? parent : document).getElementsByClassName(className));
}

function toArray(smth) {
  return Array.prototype.slice.call(smth);
}

function syncFields(fields, value) {
  fields.forEach(function(field){
    field.value = value;
  });
}

function addListener(elements, event, handler) {
  elements.forEach(function(element){
    element.addEventListener(event, handler);
  });
}

function mod(x, y){
  x = x % y;
  if(x < 0) x += y;
  return x;
}

// Получение элемента массива. Индекс "зацикливается"
function element(array, n){
  return array[mod(n, array.length)];
}

// https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Using_full_screen_mode
function toggleFullScreen() {
  if (!document.fullscreenElement &&    // alternative standard method
      !document.mozFullScreenElement &&
      !document.webkitFullscreenElement &&
      !document.msFullscreenElement ) {  // current working methods
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

// viewer functions ------------------------------------------------------------

// Получение изображений по умолчанию
function getImages(from, remove) {
  function image(name) {
    var img = getElement(name, from);
    return new DefaultImage(img.src, img.width, img.height);
  }
  
  var images = {
    loading: image('loading'),
    error: image('error'),
    logo: image('logo')
  };
  
  if(remove) from.parentNode.removeChild(from);
  return images;
}

// Получение элементов интерфейса
function getUI(from) {
  return {
    // fields
    imgNumber: getElements('go-number', from),
    slideshowDelay: getElements('slideshow-time', from),
    updateDelay: getElements('update-delay', from),
    // field-like elements
    info: getElement('info', from),
    // picture
    picture: getElement('picture', from)
  };
}

// Загрузка значения из полей fields либо из localStorage с последующей
// синхронизацией между полями
function loadValue(name, fields, defaultValue) {
  if(defaultValue !== undefined && isFinite(defaultValue))
    syncFields(fields, defaultValue);
  
  var value = localStorage.getItem(PREFIX + name);
  if(value && isFinite(+value)){
    syncFields(fields, value);
    return value;
  }
  return fields.length ? fields[0].value : '';
}

// Сохранение значения в localStorage с синхронизацией между полями
function saveValue(name, fields, value) {
  syncFields(fields, value);
  localStorage.setItem(PREFIX + name, value);
}

// Среднее значение "за последнее время"
// При примерно равных входных данных будет учитываться
// примерно N последних значений
function Average(N){
  this.k = 1 - 1/N;
  this.a = 0;
  this.n = 0;
  this.entries = 0;
}

Average.prototype.add = function(val) {
  this.a = val + this.a * this.k;
  this.n =   1 + this.n * this.k;
  ++ this.entries;
  return this;
};

Average.prototype.value = function() {
  return this.a / this.n;
};

var VERSION = '2.0 pre 9';
var PREFIX = 'sekrasoft-viewer-2-';

// Загрузчик изображения: обёртка над Image с возможностью хранения
// размеров/масштаба, времени загрузки и т.п.
// Пользователю ImageLoader следует определить свою onevent.
function ImageLoader(url) {
  this.url = url;
  this.img = null;
  this.loading = false;
  this.loaded = false;
  this.width = 0; // настоящая ширина самой картинки в пикселях
  this.height = 0; // настоящая высота самой картинки в пикселях
  this.angle = 0; // угол поворота в градусах
  this.shiftX = 0; // сдвиг картинки в единицах ширины
  this.shiftY = 0; // сдвиг картинки в единицах высоты
  this.scale = 1; // масштаб картинки. Равен одному, когда она растянута на весь экран
  this.time = -1; // время загрузки картинки
}

// TODO: Почему изменяется ImageLoader.prototype.nowLoading, а не this.nowLoading?
ImageLoader.prototype.nowLoading = 0;

ImageLoader.prototype.setLoading = function(state) {
  if(state) ++ ImageLoader.prototype.nowLoading;
  else -- ImageLoader.prototype.nowLoading;
  // console.log('now loading: ' + this.nowLoading);
};

// Загрузка состояния из localStorage
ImageLoader.prototype._loadOptions = function(){
  var options = localStorage.getItem(PREFIX + 'pic-' + url);
  if(!options) return;
  var o = options.split(' ');
  if(o.length !== 4) return;

  if(isFinite(+o[0])) this.angle = +o[0];
  if(isFinite(+o[1])) this.scale = +o[1];
  if(isFinite(+o[2])) this.shiftX = +o[2];
  if(isFinite(+o[3])) this.shiftY = +o[3];
};

// Сохранение состояния в localStorage
ImageLoader.prototype._saveOptions = function(){
  if(this.angle != 0 ||
     Math.abs(this.scale - 1) * Math.max(this.width, this.height) >= 1 ||
     Math.abs(this.shiftX * this.width) >= 1 ||
     Math.abs(this.shiftY * this.height) >= 1) {
     
    localStorage.setItem(PREFIX + 'pic-' + this.url,
      this.angle + ' ' + this.scale + ' ' + this.shiftX + ' ' + this.shiftY);
  } else {
    localStorage.removeItem(PREFIX + 'pic-' + this.url);
  }
};

// onevent вызывается с img, когда img загрузилось или произошла ошибка загрузка
// onevent вызывается с null, когда меняется количество загружаемых изображений
ImageLoader.prototype.onevent = function(img) {
  if(!img) throw new Error('No handler');
  throw new Error('No handler: IMAGE ' + img.url + ' ' +
    (img.loaded ? 'is loaded' : 'is not loaded'));
};

ImageLoader.prototype.load = function() {
  if(this.loading || this.loaded && this.img) return;
  var time = +new Date;
  var that = this;
  this.img = new Image;
  this.loaded = false;
  this.loading = true;
  this.img.onload = function(){
    that.time = new Date - time;
    that.width = this.width;
    that.height = this.height;
    that.loading = false;
    that.loaded = true;
    that.setLoading(false);
    that.onevent(that);
  };
  this.img.onerror = function(){
    that.loading = false;
    that.setLoading(false);
    that.onevent(that);
  };
  this.img.src = this.url;
  this.setLoading(true);
};

ImageLoader.prototype.unload = function() {
  if(!this.img) return;
  this.img.onload = null;
  this.img.onerror = null;
  this.img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAA' +
  'AAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhs' +
  'AAAABYktHRP+lB/LFAAAADUlEQVQYV2Po6Oj4DwAFzAKYHYYI3AAAAABJRU5ErkJggg==';
  this.img = null;
  this.time = -1;
  if(this.loading) this.setLoading(false);
  this.loading = false;
};

ImageLoader.prototype.setScale = function(scale) {
  this.scale = scale;
  this._saveOptions();
};

ImageLoader.prototype.setAngle = function(angle) {
  this.angle = angle;
  this._saveOptions();
};

ImageLoader.prototype.setShift = function(sx, sy) {
  this.shiftX = sx;
  this.shiftY = sy;
  this._saveOptions();
};

// Изображение по умолчанию. Эмулирует ImageLoader
function DefaultImage(url, width, height) {
  this.url = url;
  this.width = width;
  this.height = height;
  this.scale = 0.5;
  this.loaded = true;
}

DefaultImage.prototype = new ImageLoader(':');
DefaultImage.prototype.constructor = DefaultImage;

DefaultImage.prototype.load = function() {};
DefaultImage.prototype.unload = function() {};
DefaultImage.prototype.setScale = function(scale) {};
DefaultImage.prototype.setAngle = function(angle) {};
DefaultImage.prototype.setShift = function(sx, sy) {};

// Показ изображений. Загружает картинку в element; отображает информацию
// о показе в info; считает, что размер element - width * height
function ImageShow(element, info, width, height) {
  this.element = element;
  this.info = info;
  this.width = width; // ширина экрана
  this.height = height; // высота экрана
  this.id = 0;
  this.url = '';
  this.image = null;
  this.slideshow = 0;
  this.slideshowDelay = parameters.DEFAULT_SLIDESHOW_DELAY;
  this.loadTime = new Average(parameters.LOAD_TIME_ACCOUNT_FOR_IMAGES);
  this.loadDelay = new Average(parameters.LOAD_DELAY_ACCOUNT_FOR_IMAGES);
  
  this.images = [];
  
  var that = this, previousLoad = new Date - parameters.FIRST_LOAD_DELAY;
  // действие при загрузке изображения или изменении количества загружаемых
  this.imageLoaderHandler = function(loader) {
    if(!loader.loaded) {
      console.log('reloading.plan', loader.url);
      setTimeout(function(){
        console.log('reloading', loader.url);
        loader.load();
        if(that.url === loader.url)
          that.show(loader);
      }, parameters.RELOAD_TIMEOUT);
    }
    
    if(that.url === loader.url) that.show(loader);
    
    if(loader.time >= 0) that.loadTime.add(loader.time);
    that.loadDelay.add(new Date - previousLoad);
    previousLoad = new Date;
    
    that.adjustImagesNumber();
  };
}

ImageShow.prototype._adjusting = false;
ImageShow.prototype.forwardImages = 1;
ImageShow.prototype.backwardImages = 0;
ImageShow.prototype.imagesPerTime = parameters.DEFAULT_IMAGES_PER_TIME;
ImageShow.defaultImages = {};

// Подгоняет количество загружаемых изображений
// в зависимости от условий загрузки
ImageShow.prototype.adjustImagesNumber = function(byUser) {
  if(this._adjusting || !this.images.length) return;
  this._adjusting = true;
  
  var time = this.loadTime.value(), delay = this.loadDelay.value();
  var oldForward = this.forwardImages, oldBackward = this.backwardImages;
  var shortQueue = ImageLoader.prototype.nowLoading <= this.imagesPerTime;
  var thisIsLoaded = this.images[this.id].loaded;
  
  // Если планируется загрузить не так много картинок или они загружались давно
  // (более MAX_LAST_LOAD_DELAYмс назад, т.е. сервер не очень нагружается)
  // и при этом они загружаются быстро (менее MIN_LAST_LOAD_TIMEмс в среднем
  // за последнее время) или многие уже загрузились и сейчас загрузчик
  // почти простаивает, то можно увеличить количество загружаемых изображений.
  // Скорее всего, ни браузер, ни сервер не будет в печали.
  if ((delay > parameters.MAX_LAST_LOAD_DELAY ||
    this.forwardImages <= parameters.MAX_IMAGES_PER_TIME) &&
    (time < parameters.MIN_LAST_LOAD_TIME || shortQueue)) {
    
    // увеличиваем количество планируемых изображений
    this.forwardImages = (this.forwardImages + 1) * parameters.LOADING_INC_RATIO | 0;
    
    // лимит кэша нельзя превышать
    if(this.forwardImages > parameters.MAX_FORWARD_IMAGES)
      this.forwardImages = parameters.MAX_FORWARD_IMAGES;
    
    // лимит загружаемых одновременно изображений не будем превышать
    if(this.forwardImages - oldForward +
      ImageLoader.prototype.nowLoading > parameters.MAX_IMAGES_PER_TIME) {
      
      // запланируем столько изображений, сколько загрузилось
      // плюс лимит одновременной загрузки
      this.forwardImages = oldForward +
        (parameters.MAX_IMAGES_PER_TIME - ImageLoader.prototype.nowLoading);
      
      // но не будем спорить со своими решениями и загружать меньше,
      // чем решили в прошлый раз
      if(this.forwardImages < oldForward)
        this.forwardImages = oldForward;
    }
  
  // если фотографии грузятся медленно (более MAX_LAST_LOAD_TIMEмс в среднем
  // за последнее время и при этом мы не успеваем: или пользователь нажал на
  // кнопку и нам нужно торопиться, или он вообще дошёл до того места,
  // где картинка не прогрузилась, уменьшаем количество загружаемых изображений
  } else if(time > parameters.MAX_LAST_LOAD_TIME && (byUser || !thisIsLoaded)) {
    this.forwardImages = this.forwardImages / parameters.LOADING_DEC_RATIO - 1 | 0;
    if(this.forwardImages <= 0) this.forwardImages = 1;
  }
  
  // см. комментарии выше; всё аналогично, только количество "задних"
  // изображений растёт медленнее. Надеемся, что пользователь листает вперёд.
  if ((delay > parameters.MAX_LAST_LOAD_DELAY2 ||
    this.backwardImages <= parameters.MAX_IMAGES_PER_TIME) &&
    (time < parameters.MIN_LAST_LOAD_TIME2 || shortQueue)) {
    
    this.backwardImages = (this.backwardImages + 1) * parameters.LOADING_INC_RATIO2 | 0;
    
    if(this.backwardImages > parameters.MAX_BACKWARD_IMAGES)
      this.backwardImages = parameters.MAX_BACKWARD_IMAGES;
      
    if(this.backwardImages - oldBackward +
      ImageLoader.prototype.nowLoading > parameters.MAX_IMAGES_PER_TIME) {
      
      this.backwardImages = oldBackward +
        (parameters.MAX_IMAGES_PER_TIME - ImageLoader.prototype.nowLoading);
        
      if(this.backwardImages < oldBackward)
        this.backwardImages = oldBackward;
    }
  } else if(time > parameters.MAX_LAST_LOAD_TIME2 && (byUser || !thisIsLoaded)) {
    this.backwardImages = this.backwardImages / parameters.LOADING_DEC_RATIO2 - 1 | 0;
    if(this.backwardImages <= 0) this.backwardImages = 1;
  }
  
  // Если мы планируем подгрузить слишком много картинок, больше, чем у нас,
  // то из-за зацикливания мы можем отменить загрузку тех картинок,
  // которые требуется загружать. Скажем, было у нас 5 картинок, мы загружали
  // 12 штук, потом решили загружать 7. Отменяем загрузку пяти лишних картинок -
  // отменяется загрузка ВСЕХ картинок из-за зацикливания.
  if(this.images.length < this.forwardImages + this.backwardImages + 1) {
    // Сначала урезаем количество "задних" изображений. Вообще, когда мы
    // загружаем все изображения, не важно, "сзади" или "спереди"...
    if(this.forwardImages + 1 >= this.images.length)
      this.backwardImages = 0;
    else
      this.backwardImages -=
        this.forwardImages + this.backwardImages + 1 - this.images.length;
  }
  
  // Если урезание "задних" не помогло и мы продолжаем загружать больше,
  // чем надо, урезаем количество "передних".
  if(this.images.length < this.forwardImages + this.backwardImages + 1) {
    this.forwardImages -=
      this.forwardImages + this.backwardImages + 1 - this.images.length;
  }
  
  var id = this.id;
  
  // Если в прошлый раз мы загружали больше, чем надо,
  // отменяем загрузку лишних картинок
  if(this.forwardImages < oldForward)
    for(var i = id + this.forwardImages + 1; i <= id + oldForward; ++ i)
      element(this.images, i).unload();
  
  if(this.backwardImages < oldBackward)
    for(var i = id - this.backwardImages - 1; i >= id - oldBackward; -- i)
      element(this.images, i).unload();
      
  // Если в прошлый раз мы загружали меньше, чем надо,
  // начинаем загружать новые изображения
  if(this.forwardImages > oldForward)
    for(var i = id + oldForward + 1; i <= id + this.forwardImages; ++ i)
      element(this.images, i).load();
  
  if(this.backwardImages > oldBackward)
    for(var i = id - oldBackward - 1; i >= id - this.backwardImages; -- i)
      element(this.images, i).load();
  
  // console.log('------------------------------------------------');
  // for(var i = id - this.backwardImages; i <= id + this.forwardImages; ++i) {
    // var n = mod(i, this.images.length), img = element(this.images, i);
    // console.log('ID', n+1, n == id ? 'that' : '',
      // img.loading ? 'loading' : 'stopped', img.loaded ? 'loaded' : '-');
  // }
  
  // console.log('STATS: ' + time + 'ms x' + this.loadTime.n);
  // console.log('DELAY: ' + delay + 'ms x' + this.loadDelay.n);
  // console.log('FWD', oldForward, this.forwardImages);
  // console.log('BCK', oldBackward, this.backwardImages);
  
  if(!byUser) this.updateInfo();
  this._adjusting = false;
};

// Обновление информации о показе: текущее изображение, количество,
// сколько изображений загружается и сколько готово к просмотру
ImageShow.prototype.updateInfo = function() {
  var text;
  if(this.id < this.images.length) {
    text = (this.id + 1) + '/' + this.images.length;

    // Считаем количества изображений рядом с текущим, которые точно загрузились
    var p = 0, n = 0;
    for(var i = this.id + 1; n <= this.images.length; ++i, ++n)
      if(!element(this.images, i).loaded) break;
    if(n > this.images.length) n = this.images.length;
    for(var i = this.id - 1; p <= this.images.length; --i, ++p)
      if(!element(this.images, i).loaded) break;
    if(p > this.images.length) p = this.images.length;
    
    if(p < this.images.length || n < this.images.length)
      text += '<br/><div class="preload-info">&larr;' + p + ' ' +
        ImageLoader.prototype.nowLoading + ' ' + n + '&rarr;</div';
    
    var hash = '#' + String(this.id + 1);
    if(window.history && history.replaceState){
       window.history.replaceState({}, document.title, hash);
    } else {
       location.replace(hash);
    }
  } else if(!this.images.length) {
    text = '';
  } else {
    text = ':(';
  }
  if(this.slideshow && text) text = '&#9658; ' + text;
  this.info.innerHTML = text;
};

ImageShow.prototype.show = function(image) {
  // console.log('show', image.url);
  if(!image) return;
  this.url = image.url;
  if(image.loaded) {
    this._show(image);
  } else if(image.loading) {
    this._show(this.defaultImages.loading);
  } else {
    this._show(this.defaultImages.error);
  }
  this.adjustImagesNumber(true);
};

ImageShow.prototype._show = function(image) {
  this.image = image;
  this.element.src = image.url;
  this.redraw();
};

ImageShow.prototype.reload = function() {
  if(!this.images.length) return;
  this.image.unload();
  this.image.load();
};

ImageShow.prototype.resize = function(width, height) {
  this.width = width;
  this.height = height;
  this.redraw();
};

// Получение масштаба изображения с учётом размера картинки, разрешения поля и
// пользовательского масштаба
ImageShow.prototype._scale = function() {
  // Изображение повёрнуто на 90 или 270 градусов: ширина и высота меняются
  var badAngle = 90 == Math.abs(this.image.angle) % 180;
  
  var scale, iw, ih;
  
  if(badAngle) {
    iw = this.image.height;
    ih = this.image.width;
  } else {
    iw = this.image.width;
    ih = this.image.height;
  }
  
  if(this.width / this.height > iw / ih) {
    scale = this.height / ih * this.image.scale; // упираемся высотой
  } else {
    scale = this.width / iw * this.image.scale; // упираемся шириной
  }
  
  return scale;
};

// "Перерисовка" - установка масштаба и поворота
ImageShow.prototype.redraw = function() {
  this.updateInfo();
  
  // Поворот картинки на нужный угол
  var angleVal = 'rotate(' + this.image.angle + 'deg)';
  this.element.style.webkitTransform = angleVal; // Chrome и Safari
  this.element.style.MozTransform = angleVal; // Firefox
  this.element.style.OTransform = angleVal; // Opera
  this.element.style.transform = angleVal; // Opera
  
  var scale = this._scale();
  
  // длина и ширина картинки в пикселях
  var width = scale * this.image.width;
  var height = scale * this.image.height;
  
  // сдвиг картинки в пикселях
  var shiftX = this.image.shiftX * width;
  var shiftY = this.image.shiftY * height;
  
  // установка длины/ширины
  this.element.style.width = width + 'px';
  this.element.style.height = height + 'px';
  
  // установка положения картинки относительно краёв экрана с учётом сдвига
  this.element.style.top = ((this.height - height) / 2 + shiftY) + 'px';
  this.element.style.left = ((this.width - width) / 2 + shiftX) + 'px';
};

// Обновление списка изображений.
// urls - массив адресов изображений
ImageShow.prototype.update = function(urls){
  var changed = false, that = this;
  if(urls.length !== this.images.length) changed = true;
  else {
    var imagesByURL = {};
    this.images.forEach(function(img){
      imagesByURL[img.url] = true;
    });
    urls.forEach(function(url){
      if(!(url in imagesByURL)) changed = true;
    });
  }
  if(!changed) return;
  
  this.images = urls.map(function(url){
    var img = new ImageLoader(url);
    img.onevent = that.imageLoaderHandler;
    return img;
  });
  
  that.id = this.idFromHash();
  this.images.forEach(function(img, id){
    if(that.url === img.url) that.id = id;
  });
  this.goTo(this.id);
};

ImageShow.prototype.originalSize = function() {
  this.image.setScale(1.0);
  this.image.setShift(0, 0);
  this.redraw();
};

ImageShow.prototype.shift = function(sx_px, sy_px) {
  var scale = this._scale();
  this.image.setShift(
    this.image.shiftX + sx_px / scale / this.image.width,
    this.image.shiftY + sy_px / scale / this.image.height);
  this.redraw();
};

ImageShow.prototype.zoomIn = function() {
  this.image.setScale(this.image.scale * parameters.ZOOM_SCALE_RATIO);
  this.redraw();
};

ImageShow.prototype.zoomOut = function() {
  this.image.setScale(this.image.scale / parameters.ZOOM_SCALE_RATIO);
  this.redraw();
};

ImageShow.prototype.rotateClockwise = function() {
  this.image.setAngle(mod(this.image.angle + 90, 360));
  this.redraw();
};

ImageShow.prototype.rotateCounterclockwise = function() {
  this.image.setAngle(mod(this.image.angle - 90, 360));
  this.redraw();
};

// получение номера картинки из location.hash
ImageShow.prototype.idFromHash = function() {
  if(!location.hash) return;
  var id = +location.hash.substring(1);
  return isFinite(+id) ? +id : 1;
};

// переход к картинке с нужным номером [1..количество картинок]
ImageShow.prototype.goTo = function(n) {
  if (!this.images.length) return;
  
  // Выставляем номер картинки в нужных пределах
  n = n | 0;
  if (n < 1) n = 1;
  if (n > this.images.length) n = this.images.length;
  --n;
  if(this.id === n) return; // уже показана
  this.id = n;
  
  var image = this.images[this.id], shown = false;
  if (image.loaded) {
    // изображение загружено? сразу его и покажем
    // а то чуть ниже делаем _всем_ unload, что может заставить
    // просмотрщик показать сначала "загружается", а потом картинку
    this._show(image);
    shown = true;
  }
  
  // TODO: rewrite
  // Ленивый способ: сначала всё отменяем, потом всё нужное загружаем
  this.images.forEach(function(img){ img.unload(); });
  var i = this.id - this.backwardImages;
  n = this.id + this.forwardImages;
  for(; i <= n; ++i) element(this.images, i).load();
  
  // Если изображение не загрузилось, просмотрщик разберётся
  if(!shown) this.show(image);
};

ImageShow.prototype.previous = function() {
  if (!this.images.length) return;
  
  // Если загружается меньше изображений, чем все, отменяем загрузку того, что
  // с "переднего" конца и добавляем загрузку одного с "заднего" конца
  if(this.images.length > this.backwardImages + this.forwardImages + 1){
    element(this.images, this.id + this.forwardImages).unload();
    -- this.id;
    element(this.images, this.id - this.backwardImages).load();
  } else {
    -- this.id;
  }
  if(this.id < 0) this.id = this.images.length - 1;
  this.show(this.images[this.id]);
};

ImageShow.prototype.next = function() {
  if (!this.images.length) return;
  
  // Если загружается меньше изображений, чем все, отменяем загрузку того, что
  // с "заднего" конца и добавляем загрузку одного с "переднего" конца
  if(this.images.length > this.backwardImages + this.forwardImages + 1){
    element(this.images, this.id - this.backwardImages).unload();
    ++ this.id;
    element(this.images, this.id + this.forwardImages).load();
  } else {
    ++ this.id;
  }
  if(this.id >= this.images.length) this.id = 0;
  this.show(this.images[this.id]);
};

ImageShow.prototype.startSlideshow = function() {
  if(this.slideshow || !this.images.length) return;
  var that = this;
  this.slideshow = setTimeout(function(){
    that.slideshow = 0;
    that.next();
    that.startSlideshow();
  }, this.slideshowDelay);
  this.updateInfo();
};

ImageShow.prototype.stopSlideshow = function() {
  if(!this.slideshow) return;
  clearTimeout(this.slideshow);
  this.slideshow = 0;
  this.updateInfo();
};

ImageShow.prototype.setSlideshowDelay = function(n){
  this.slideshowDelay = n * SEC | 0;
};

(function main(){
  var UIcontainer = getElement('container');
  var UI = getUI(UIcontainer);
  var show = new ImageShow(UI.picture, UI.info, window.innerWidth, window.innerHeight);
  show.defaultImages = getImages(getElement('default-images'), true);
  show.show(show.defaultImages.logo);
  show.setSlideshowDelay(loadValue('slideshow-delay', UI.slideshowDelay,
    parameters.DEFAULT_SLIDESHOW_DELAY / SEC));
  
  UI.update = getElements('update');
  
  var listUpdateDelay = loadValue('update-delay', UI.updateDelay,
    parameters.DEFAULT_LIST_UPDATE_DELAY / SEC);
  var imageNumber = loadValue('image-number', UI.imgNumber);
  
  var fileListPath = location.search.substring(1);
  var filelist = document.getElementById('filelist');

  // При обновлении странички во фрейме обновляем show: добавляем адреса картинок
  filelist.addEventListener('load', function (){
    try{
      filelist.contentDocument;
    }catch(e){
      setTimeout(updateFileList, parameters.RELOAD_TIMEOUT);
      return;
    }
    
    var urls = toArray(filelist.contentDocument.getElementsByTagName('a'))
      .filter(function(a){
        return parameters.EXTENSIONS_RE.test(a.href);
      })
      .map(function(a){
        return a.href;
      });
    
    show.update(urls);
    UI.update.forEach(function(b){ b.disabled = false; });
    setTimeout(updateFileList, listUpdateDelay * SEC);
  });
  
  filelist.addEventListener('error', function(){
    UI.update.forEach(function(b){ b.disabled = false; });
    setTimeout(updateFileList, parameters.RELOAD_TIMEOUT);
  });
  
  function updateFileList() {
    UI.update.forEach(function(b){ b.disabled = true; });
    filelist.src = fileListPath;
  }
  
  updateFileList();

  addListener(UI.imgNumber, 'change', function(event){
    imageNumber = this.value | 0;
    if(imageNumber > show.images.length) imageNumber = show.images.length;
    if(imageNumber <= 0) imageNumber = 1;
    saveValue('image-number', UI.imgNumber, imageNumber);
  });

  addListener(UI.updateDelay, 'change', function(event){
    listUpdateDelay = this.value | 0;
    if(listUpdateDelay <= 5) listUpdateDelay = 5;
    saveValue('update-delay', UI.updateDelay, listUpdateDelay);
  });

  addListener(UI.slideshowDelay, 'change', function(event){
    var delay = this.value | 0;
    if(delay < 1) delay = 1;
    saveValue('slideshow-delay', UI.slideshowDelay, delay);
    show.setSlideshowDelay(delay);
  });
  
  function listen(name, event, handler) {
    addListener(getElements(name, UIcontainer), event, handler);
  }

  listen('go', 'click', function(event){ show.goTo(imageNumber); });

  listen('slideshow-start', 'click', function(event){ show.startSlideshow(); });
  
  listen('slideshow-stop', 'click', function(event){ show.stopSlideshow(); });
  
  listen('slideshow-toggle', 'click', function(event){
    if(show.slideshow) show.stopSlideshow();
    else show.startSlideshow();
  });

  listen('update', 'click', updateFileList);
  listen('prev', 'click', function(event){ show.previous(); });
  listen('next', 'click', function(event){ show.next(); });
  listen('left', 'click', function(event){ show.rotateCounterclockwise(); });
  listen('right', 'click', function(event){ show.rotateClockwise(); });
  listen('size-max', 'click', function(event){ show.zoomIn(); });
  listen('size-min', 'click', function(event){ show.zoomOut(); });
  listen('size-def', 'click', function(event){ show.originalSize(); });
  
  //////////////////////////////////////////////////////////////////////////////
  // TODO: rewrite
  
  (function(){
    var mouseX0, mouseY0;
    var mouseX, mouseY;
    var down = false;
    
    window.addEventListener('mousedown', function(event) {
      mouseX0 = event.clientX; mouseY0 = event.clientY;
      mouseX = event.clientX; mouseY = event.clientY;
      // console.log('mousedown',event);
      down = true;
    });
    
    window.addEventListener('mousemove', function(event) {
      if(!down) return;
      event.preventDefault();
      show.shift(event.clientX - mouseX, event.clientY - mouseY);
      mouseX = event.clientX; mouseY = event.clientY;
      // console.log('mousemove',event);
    });
    
    window.addEventListener('mouseup', function(event) {
      down = false;
      // console.log('mouseup',event);
    });
  
  })();
  
  // (function(){
    // var mouseX0, mouseY0;
    // var mouseX, mouseY;
    
    // window.addEventListener('touchstart', function(event) {
      // mouseX0 = event.touches[0].clientX; mouseY0 = event.touches[0].clientY;
      // mouseX = event.touches[0].clientX; mouseY = event.touches[0].clientY;
      // console.log('touchstart',event);
    // });
    
    // window.addEventListener('touchmove', function(event) {
      // event.preventDefault();
      // show.shift(event.touches[0].clientX - mouseX, event.touches[0].clientY - mouseY);
      // mouseX = event.touches[0].clientX; mouseY = event.touches[0].clientY;
      // console.log('touchmove',event);
    // });
    
    // window.addEventListener('touchend', function(event) {
      // console.log('touchend',event);
    // });
  
    // window.addEventListener('touchcancel', function(event) {
      // console.log('touchcancel',event);
    // });
  
  // })();
    
  addListener(getElements('fullscreen-mode'), 'click', toggleFullScreen);
  
  window.addEventListener('dblclick', function(){
    show.reload();
  });
  
  // TODO: напоминание об углах?
  // TODO: всё в файл?
  // TODO: адрес?
  // TODO: div.info куда-то делась в IE11
  
  // TODO: ориентация на листание назад/random access
  // TODO: autoresize
  // TODO: привязка к внутренним
  // TODO: shift with mouse
  // TODO: shift & zoom with touchscreen

  window.addEventListener('keydown', function(event) {
    if(event.target.tagName === 'INPUT') return;
    
    if(event.altKey && event.keyCode === 13) { // Alt+Enter
      toggleFullScreen();
      return;
    }
  
    if(event.altKey || event.ctrlKey || event.metaKey) return;
    switch(event.keyCode){
      case 32: // space
      case 39: // right
        show.next(); break;
      case 37: // left
        show.previous(); break;
      case 38: // up
        show.rotateCounterclockwise(); break;
      case 40: //down
        show.rotateClockwise(); break;
      case 48: // 0
        show.originalSize(); break;
      case 187: // =
      case 107: // gray +
      case 61: // moz +
        show.zoomIn(); break;
      case 189: // -
      case 109: // gray -
      case 173: // moz -
        show.zoomOut(); break;
      case 83: // s
        if(show.slideshow) show.stopSlideshow();
        else show.startSlideshow();
        break;
      case 36: // Home
        show.goTo(1);
        break;
      case 35: // End
        show.goTo(show.images.length);
        break;
      case 70: // f
        toggleFullScreen();
      case 33: // PgUp
        break;
      case 34: // PgDn
        break;
      // default: console.log('button '+event.keyCode, event);
    }
  });
  
  function setWindowSize(event) {
    show.resize(window.innerWidth, window.innerHeight);
  }
  
  window.addEventListener('resize', setWindowSize);
  window.addEventListener('scroll', setWindowSize);

  window.addEventListener('hashchange', function(event){
    show.goTo(show.idFromHash());
  });
  
  window.addEventListener('wheel', function(event){
    if (!event.shiftKey) return;
    if (event.deltaX < 0 || event.deltaY < 0) show.zoomIn()
    else if (event.deltaX > 0 || event.deltaY > 0) show.zoomOut();
  });
  
  if(navigator.userAgent.indexOf("Chrome")==-1){
    getElements('warning', UIcontainer).forEach(function(w){
      w.innerHTML = '<span style="font-size: 80%">Используйте Chrome</span><br>';
        w.innerHTML += '<span style="font-size: 80%">для стабильной работы.</span>';
    });
  }
  
  getElements('viewer-loading').forEach(function(e){
    e.parentNode.removeChild(e);
  });
  
  document.title += ' ' + VERSION;

})(); // end of main

})(); // end of module
