CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  this.beginPath();
  this.moveTo(x+r, y);
  this.arcTo(x+w, y,   x+w, y+h, r);
  this.arcTo(x+w, y+h, x,   y+h, r);
  this.arcTo(x,   y+h, x,   y,   r);
  this.arcTo(x,   y,   x+w, y,   r);
  this.closePath();
  return this;
}

// TODO: онбординг?
// TODO: заглушки на первом экране, что картинка грузится? а то тупо скачет
// TODO: другие фотки толпы, разнообразные
// TODO: тексты для шаринга
// TODO: модалка какая то для обработки ошибок?


var facePhotoId = 0
var mixId = 0
var facesPhotos = []
var crowdPhoto = {
    url: '',
    crop: [0, 0, 1, 1],
    rotation: 0,
    flip: 0
}

var shareBtn = document.getElementById('shareBtn')
var answerBtn = document.getElementById('answerBtn')
var mixBtn = document.getElementById('mixBtn')
var facesDiv = document.getElementById('facesDiv')
var progressSteps = document.getElementById('progressSteps')
var screensStack = []

function updateSteps() {
    var screen = screensStack[screensStack.length - 1]
    if (screen.step) {
        progressSteps.style.display = 'flex'
    } else {
        progressSteps.style.display = 'none'
    }
}

function pushScreen(id, destroyFunc) {
    screensStack.push({
        id: id,
        div: document.getElementById(id),
        step: document.getElementById(id + 'Step'),
        destroy: destroyFunc
    })

    var screen = screensStack[screensStack.length - 1]
    screen.div.style.display = 'flex'
    if (screen.step) {
        screen.step.classList.add('progress-steps__step--active')
    }

    updateSteps()
}

function popScreen() {
    if (screensStack.length === 1) {
        return // cannot pop last screen
    }

    var screen = screensStack[screensStack.length - 1]
    screen.div.style.display = 'none'
    if (screen.step) {
        screen.step.classList.remove('progress-steps__step--active')
    }
    if (screen.destroy) {
        screen.destroy()
    }
    screensStack.length = screensStack.length - 1

    updateSteps()
}

function resetScreens() {
    facesDiv.innerHTML = ''
    facesPhotos.length = 0
    crowdPhoto = {
        url: '',
        crop: [0, 0, 1, 1],
        rotation: 0,
        flip: 0
    }
    updateFacesScreenUI()

    while(screensStack.length > 1) {
        popScreen()
    }
}

function openStartScreen() {
    pushScreen('startScreen')
}

function openFacesScreen() {
    if (screensStack.length > 0) {
        screensStack[0].div.style.display = 'none'
    }
    screensStack.length = 0
    updateFacesScreenUI()
    pushScreen('facesScreen')
}

function selectFacePhoto() {
    selectNativePhoto(function (photo) {
        pushFacePhoto(photo)

        updateFacesScreenUI()
    })
}

function selectCrowdPhoto() {
    selectNativePhoto(function (photo) {
        crowdPhoto = photo
        openCookingScreen()
    })
}

function pushFacePhoto(photo) {
    facesPhotos.push(photo)

    var div = document.createElement('div')
    div.classList.add('faceBlock')

    var img = new Image()
    img.src = photo.url
    div.appendChild(img)

    var edit = document.createElement('div')
    edit.classList.add('faceBlockEdit')
    edit.addEventListener('click', function () {
        selectNativePhoto(function (photo) {
            img.src = photo.url
        })
    })
    edit.innerHTML = 'Edit'
    div.appendChild(edit)

    var remove = document.createElement('div')
    remove.classList.add('faceBlockRemove')
    remove.addEventListener('click', function () {
        facesPhotos = facesPhotos.filter(function (p) { return p.id !== photo.id })
        facesDiv.removeChild(div)
        updateFacesScreenUI()
    })
    remove.innerHTML = 'X'
    div.appendChild(remove)

    facesDiv.appendChild(div)
}

function updateFacesScreenUI() {
    var buttons = document.querySelector('#facesScreen .actionButtons')
    if (facesPhotos.length > 0) {
        buttons.style.display = 'flex'
    } else {
        buttons.style.display = 'none'
    }

    var plus = document.querySelector('#facesScreen .genePlus')
    if (facesPhotos.length > 1) {
        plus.style.display = 'none'
    } else {
        plus.style.display = 'block'
    }
}

function isLocalTest() {
    return location.host.indexOf('127.0.0.1') !== -1
}

function selectNativePhoto(onPhotoSelected) {
    if (isLocalTest()) {
        var photo = {
            url: Math.random() > 0.5 ? 'https://s16.stc.all.kpcdn.net/share/i/12/10577981/inx960x640.jpg' : 'https://www.hindustantimes.com/rf/image_size_960x540/HT/p2/2019/02/02/Pictures/russia-politics-putin_9b482d60-26e6-11e9-b3a2-37e00a7683f5.jpg',
            crop: [0, 0, 1, 1],
            rotation: 0,
            flip: 0,
            id: facePhotoId++
        }
        onPhotoSelected(photo)
        return
    }

    var callback = 'nativePhotoSelected'
    window[callback] = function (result) {
        var photos = result.photos
        var photo = photos[0]
        if (photo) {
            photo.id = facePhotoId++
            photo.url = photo.image_url
            onPhotoSelected(photo)
        }
    }
    location.href = 'callback:nativePhotoSelect?func=' + callback
}

function openCrowdScreen() {
    pushScreen('crowdScreen')
}

function openCookingScreen() {
    var cookingFaces = document.getElementById('cookingFaces')
    cookingFaces.innerHTML = ''

    var cookingCrowd = document.getElementById('cookingCrowd')
    cookingCrowd.innerHTML = ''

    for (var i = 0; i < facesPhotos.length; i++) {
        var img = new Image()
        img.src = facesPhotos[i].url
        cookingFaces.appendChild(img)
    }

    var crowdImage = new Image()
    crowdImage.src = crowdPhoto.url
    cookingCrowd.appendChild(crowdImage)

    pushScreen('cookingScreen', function () {
        mixBtn.classList.remove('loading')
        mixId++
    })
}

function mixSelectedPhotos() {
    if (mixBtn.classList.contains('loading')) {
        return
    }

    mixId++

    var thisMixId = mixId

    mixBtn.classList.add('loading')

    var payload = {
        me: facesPhotos[0],
        friend: facesPhotos[1],
        crowd: crowdPhoto
    }

    var resultPromise
    if (false && isLocalTest()) {
        resultPromise = new Promise(function (resolve) {
            setTimeout(function () {
                resolve({
                    url: crowdPhoto.url,
                    bboxs: [[10, 10, 50, 50], [90, 90, 120, 120]]
                })
            }, 1000)
        })
    } else {
        resultPromise = fetch('http://34.201.232.170/create_mix?data=' + JSON.stringify(payload))
            .then(function (resp) { return resp.json() })
    }

    resultPromise.then(function (data) {
        if (thisMixId !== mixId) {
            return
        }

        mixBtn.classList.remove('loading')
        openResultScreen(data)
    })
    .catch(function (error) {
        if (thisMixId !== mixId) {
            return
        }

        // TODO: show error + try again
        mixBtn.classList.remove('loading')
    })
}

function openResultScreen(data) {
    var pinchZoom
    var destroyed = false

    var body = document.querySelector('#resultScreen .contentBody')
    body.innerHTML = ''

    var canvas = document.createElement('canvas')
    body.appendChild(canvas)

    var answerIsVisible = false
    var onAnswerClick = function () {
        answerIsVisible = !answerIsVisible
    }
    answerBtn.addEventListener('click', onAnswerClick)

    var onShareClick = function () {
        shareResult(data.url)
    }
    shareBtn.addEventListener('click', onShareClick)

    setTimeout(function () {
        if (destroyed) {
            return
        }

        pinchZoom = new PinchZoomCanvas({
            canvas: canvas,
            path: data.url,
            momentum: true,
            onRender: function (zis) {
                if (answerIsVisible) {
                    var dx = zis.position.x
                    var dy = zis.position.y
                    var dw = zis.scale.x * zis.imgTexture.width
                    var dh = zis.scale.y * zis.imgTexture.height
                    zis.context.fillStyle = 'rgba(255, 255, 255, 0.6)'
                    zis.context.fillRect(dx, dy, dw, dh)

                    data.bboxs.forEach(function (bbox) {
                        var x = bbox[0]
                        var y = bbox[1]
                        var w = bbox[2] - x
                        var h = bbox[3] - y
                        var bdx = dx + x * zis.scale.x
                        var bdy = dy + y * zis.scale.y
                        var bdw = w * zis.scale.x
                        var bdh = h * zis.scale.y
                        zis.context.drawImage(zis.imgTexture, x, y, w, h, bdx, bdy, bdw, bdh)
                        zis.context.lineWidth = 2.5 * zis.scale.x
                        zis.context.strokeStyle = '#2a79ff'
                        zis.context.roundRect(bdx, bdy, bdw, bdh, 2 * zis.scale.x).stroke()
                    })
                }
            }
        })
    }, 200)

    pushScreen('resultScreen', function () {
        destroyed = true
        answerBtn.removeEventListener('click', onAnswerClick)
        shareBtn.removeEventListener('click', onShareClick)
        if (pinchZoom) {
            pinchZoom.destroy()
        }
    })
}

function shareResult(url) {
    var callbackName = 'nativeShareCallback'
    window[callbackName] = function (result) {
        if (result) {
            // shared
        } else {
            // not shared
        }

        // TODO: loading?
        resetScreens()
    }
    location.href = 'callback:nativeShare?og_image=' + encodeURIComponent(url) +
        '&og_title=' + encodeURIComponent('Title') +
        '&og_description=' + encodeURIComponent('Description') + 
        '&func=' + callbackName
}

openStartScreen()

var crowdPhotos = document.querySelectorAll('.crowdList img')
for (var i = 0; i < crowdPhotos.length; i++) {
    var photo = crowdPhotos[i]
    photo.addEventListener('click', function () {
        crowdPhoto.url = photo.src
        openCookingScreen()
    })
}

