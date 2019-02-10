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

// TODO: query params для скриптов! на каждый чендж

// stats:
// closeScreen - закрыл экран (нажал 'back', может когда то еще)
// startScreenIndia - ios & india
// startScreenAll - экран для всех остальных
// facesScreen - экран с лицами
// facePhoto - выбор фото на первом экране
// removefacePhoto - удалил фотку на первом экране
// crowdScreen - экран с фотками толпы
// crowdPhoto{} - тыкнул на пресет
// myCrowdPhoto - свою загрузил
// cookingScreen - экран с кнопкой mix
// mix - нажал кнопку микс
// resultScreen - экран результатов
// tryingToShare - нажал кнопку шаринга
// tryingToShareFromAlert - нажал пошарить из алерта
// iDontCare - отказался шарить
// shared - пошарил
// notShared - не пошарил

// ----- short ------
// shortFlowFacePhoto - выбрал фото
// shortFlowCrowdPhoto{} - рандомная фотка толпы
// shortFlowMix - микс
// shortFlowNoFaces - ошибка "нет лиц"
// shortFlowError - ошибка другая, чет с сервером
// shortFlowResetIcon - нажал иконку сброса
// shortFlowResetButton - нажал кнопку сброса, показвается если ошибка
// shortFlowMixAgain - нажал 'Mix again'
// shortFlowTryingToShare - нажал пошарить

var SERVER_ORIGIN = 'http://gene.ws.pho.to'

var IS_IOS = !!getParameterByName('vicman_unified_id')
var IS_PRODUCTION_WRAPPER = IS_IOS || !!(getParameterByName('aid') || '')
var USE_TEST_SERVER = !IS_PRODUCTION_WRAPPER || false
var COUNTRY_SHORT_NAME = (getParameterByName('country') || '').trim().toLowerCase()
var IS_USA = COUNTRY_SHORT_NAME === 'us' || COUNTRY_SHORT_NAME === 'um'
var IS_INDIA = IS_IOS && COUNTRY_SHORT_NAME === 'in'

var CROWD_PHOTOS_LIST

if (IS_INDIA) {
    CROWD_PHOTOS_LIST = [
        {
            url: location.origin + '/static/crowd/40.png',
            id: 40
        },
        {
            url: location.origin + '/static/crowd/41.jpg',
            id: 41
        },
        {
            url: location.origin + '/static/crowd/31.jpg',
            id: 31
        },
        {
            url: location.origin + '/static/crowd/43.jpg',
            id: 43
        },
        {
            url: location.origin + '/static/crowd/44.png',
            id: 44
        },
        {
            url: location.origin + '/static/crowd/45.png',
            id: 45
        },
        {
            url: location.origin + '/static/crowd/46.jpg',
            id: 46
        },
        {
            url: location.origin + '/static/crowd/47.png',
            id: 47
        },
        {
            url: location.origin + '/static/crowd/48.png',
            id: 48
        },
        {
            url: location.origin + '/static/crowd/49.jpg',
            id: 49
        }
    ]
} else {
    CROWD_PHOTOS_LIST = [
        {
            url: location.origin + '/static/crowd/32.png', // potter
            id: 32
        },
        {
            url: location.origin + '/static/crowd/31.jpg', // indian men
            id: 31
        },
        {
            url: location.origin + '/static/crowd/17.png', // hefner
            id: 17
        },
        {
            url: location.origin + '/static/crowd/20.png', // odin doma
            id: 20
        },
        {
            url: location.origin + '/static/crowd/30.png', // narnia
            id: 30
        },
        {
            url: location.origin + '/static/crowd/33.jpg', // friends
            id: 33
        },
        {
            url: location.origin + '/static/crowd/34.png', // kukli
            id: 34
        },
        {
            url: location.origin + '/static/crowd/21.png', // sinie paciki
            id: 21
        },
        {
            url: location.origin + '/static/crowd/35.png', // star trek
            id: 35
        },
        {
            url: location.origin + '/static/crowd/36.png', // straji
            id: 36
        },
        {
            url: location.origin + '/static/crowd/15.png', // les GoT
            id: 15
        },
        {
            url: location.origin + '/static/crowd/25.png', // trump
            id: 25
        },
        {
            url: location.origin + '/static/crowd/27.png', // telki
            id: 27
        },
        {
            url: location.origin + '/static/crowd/14.png', // jopa
            id: 14
        },
        {
            url: location.origin + '/static/crowd/37.jpg', // fucks
            id: 37
        },
        {
            url: location.origin + '/static/crowd/23.png', // karliki
            id: 23
        },
        {
            url: location.origin + '/static/crowd/38.jpg', // hz cho
            id: 38
        },
        {
            url: location.origin + '/static/crowd/24.png', // volosatie
            id: 24
        }
    ]
}



var LAST_DATA

var facePhotoId = 0
var mixId = 0
var facesPhotos = []
var crowdPhoto = createPhotoObject()
var resultWasShared = false
var crowdListGenerated = false

var answerIsVisible = false
var showZoomTip = true
var shareBtn = document.getElementById('shareBtn')
var answerBtn
var mixBtn = document.getElementById('mixBtn')
var facesDiv = document.getElementById('facesDiv')
var progressSteps = document.getElementById('progressSteps')
var screensStack = []

function yaReachGoal(targetName) {
    if (IS_PRODUCTION_WRAPPER) {
        ym(52246906, 'reachGoal', targetName)
    }
}

function createPhotoObject(data) {
    data = data || {}

    return {
        url: data.image_url || data.url || '',
        crop: data.crop || [0, 0, 1, 1],
        rotation: data.rotation || 0,
        flip: data.flip || 0,
        id: facePhotoId++
    }
}

function setVisible(elem, visible) {
    if (visible) {
        elem.classList.remove('geneHidden')
    } else {
        elem.classList.add('geneHidden')
    }
}

function updateSteps() {
    var screen = screensStack[screensStack.length - 1]
    setVisible(progressSteps, screen.step)
}

function pushScreen(id, destroyFunc) {
    screensStack.push({
        id: id,
        div: document.getElementById(id),
        step: document.getElementById(id + 'Step'),
        destroy: destroyFunc
    })

    // send screen reached
    yaReachGoal(id)

    var screen = screensStack[screensStack.length - 1]
    setVisible(screen.div, true)
    if (screen.step) {
        screen.step.classList.add('progress-steps__step--active')
    }

    updateSteps()
}

function popScreen(disableStat) {
    if (screensStack.length === 1) {
        return // cannot pop last screen
    }

    var screen = screensStack[screensStack.length - 1]
    setVisible(screen.div, false)
    if (screen.step) {
        screen.step.classList.remove('progress-steps__step--active')
    }
    if (screen.destroy) {
        screen.destroy()
    }
    screensStack.length = screensStack.length - 1

    if (!disableStat) {
        yaReachGoal('closeScreen')
    }

    updateSteps()
}

function resetScreens() {
    if (tryShowAlertThatResultWillBeLost(resetScreens)) {
        return
    }

    facesDiv.innerHTML = ''
    facesPhotos.forEach(function (photo) {
        if (photo.destroy) {
            photo.destroy()
        }
    })
    facesPhotos.length = 0
    crowdPhoto = createPhotoObject()
    updateFacesScreenUI()

    var list = document.querySelector('.crowdList')
    if (list) {
        list.scrollTo(0, 0)
    }

    while(screensStack.length > 1) {
        popScreen(true)
    }
}

function openStartScreen() {
    var screenId
    var imgName
    if (IS_INDIA) {
        screenId = 'startScreenIndia'
        imgName = 'india-onboarding.png'
    } else {
        screenId = 'startScreenAll'
        imgName = 'all-onboarding.png'
    }

    var screen = document.getElementById(screenId)

    var img = new Image()
    img.classList.add('onboardingImage')
    img.addEventListener('click', function () {
        openFacesScreen()
    })
    img.addEventListener('load', function () {
        screen.appendChild(img)
    })
    img.src = '/static/img/' + imgName

    pushScreen(screenId)
}

/*** SHORT FLOW ***/

var shortFlowPinchZoom
var shortUIInitialized = false
var prevCrowdIdx = 0
var shortFlowState = 'select'

function openShortFlowScreen() {
    shortFlowState = 'select'
    updateShortUI()
    pushScreen('shortFlowScreen')
}

function selectPhotoShortFlow() {
    shortFlowState = 'select'
    updateShortUI()

    selectNativePhoto(function (photo) {
        facesPhotos = [photo]
        randomShortCrowdPhotoAndMix()

        yaReachGoal('shortFlowFacePhoto')
    })
}

function randomShortCrowdPhotoAndMix() {
    var randomPhoto = CROWD_PHOTOS_LIST[prevCrowdIdx]
    prevCrowdIdx++
    crowdPhoto = createPhotoObject({
        url: randomPhoto.url
    })

    yaReachGoal('shortFlowCrowdPhoto' + randomPhoto.id)

    mixSelectedPhotosShort()
}

function mixSelectedPhotosShort() {
    yaReachGoal('shortFlowMix')

    shortFlowState = 'loading'
    updateShortUI()

    sendRequestToServer().then(function (data) {
        LAST_DATA = data

        if (data.error) {
            if (data.reason === 'no_faces') {
                yaReachGoal('shortFlowNoFaces')

                showAlert('Oops!', 'Seems like there are no faces on your photo. Please, check your photo.', [{
                    text: 'OK'
                }], function () {
                    selectPhotoShortFlow()
                })
            } else {
                yaReachGoal('shortFlowError')

                shortFlowState = 'error'
                updateShortUI()

                showAlert('Oops!', 'Seems like smth went wrong on our side. Please, try again. If problem persists, please, try another photo.', [{
                    text: 'Cancel',
                    passive: true
                }, {
                    text: 'Try again',
                    onClick: mixSelectedPhotosShort
                }])
            }
        } else {
            var img = new Image()
            img.addEventListener('load', function () {
                shortFlowState = 'result'
                updateShortUI()
            })
            img.src = data.url
        }
    })
    .catch(function (error) {
        yaReachGoal('shortFlowError')

        shortFlowState = 'error'
        updateShortUI()

        showAlert('Oops!', 'Seems like smth went wrong on our side. Please, try again.', [{
            text: 'Cancel',
            passive: true
        }, {
            text: 'Try again',
            onClick: mixSelectedPhotosShort
        }])
    })
}

function updateShortUI() {
    if (shortFlowPinchZoom) {
        shortFlowPinchZoom.destroy()
        shortFlowPinchZoom = undefined
    }

    var screen = document.querySelector('#shortFlowScreen')

    answerBtn = screen.querySelector('.answerIcon')
    answerBtn.classList.remove('answerIsVisible')

    var body = screen.querySelector('.contentBody')
    var plus = screen.querySelector('.genePlus')
    var spinner = screen.querySelector('.geneSpinner')
    var headerSpan = screen.querySelector('.header span')
    var placeholder = screen.querySelector('.faceShortPlaceholder')
    var errorIcon = screen.querySelector('.errorIcon')
    var answerIcon = screen.querySelector('.answerIcon')
    var resetIcon = screen.querySelector('.resetIcon')

    var canvas = screen.querySelector('#shortFlowResultCanvas')
    var resetBtn = screen.querySelector('#resetBtn')
    var randomCrowdBtn = screen.querySelector('#randomCrowdBtn')
    var shareBtnShort = screen.querySelector('#shareBtnShort')
    var tryAgainBtn = screen.querySelector('#tryAgainBtn')

    if (shortFlowState !== 'result') {
        var ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    if (shortFlowState === 'select') {
        placeholder.addEventListener('click', selectPhotoShortFlow)
    } else {
        placeholder.addEventListener('remove', selectPhotoShortFlow)
    }

    if (!shortUIInitialized) {
        shortUIInitialized = true

        resetIcon.addEventListener('click', function () {
            yaReachGoal('shortFlowResetIcon')

            shortFlowState = 'select'
            updateShortUI()
        })
        resetBtn.addEventListener('click', function () {
            yaReachGoal('shortFlowResetButton')

            shortFlowState = 'select'
            updateShortUI()
        })
        randomCrowdBtn.addEventListener('click', function () {
            yaReachGoal('shortFlowMixAgain')

            randomShortCrowdPhotoAndMix()
        })
        shareBtnShort.addEventListener('click', function () {
            shareResult(LAST_DATA, 'shortFlowTryingToShare')
        })
        tryAgainBtn.addEventListener('click', function () {
            mixSelectedPhotosShort()
        })
    }

    function centerText(center) {
        if (center) {
            headerSpan.style.width = '100%'
            headerSpan.style.textAlign = 'center'
        } else {
            headerSpan.style.width = 'auto'
            headerSpan.style.textAlign = 'start'
        }
    }

    if (shortFlowState === 'select') {
        headerSpan.innerHTML = 'Select photo of you or your friends'
        centerText(true)
        setVisible(answerIcon, false)
        setVisible(resetIcon, false)

        setVisible(placeholder, true)
        setVisible(plus, true)
        setVisible(spinner, false)
        setVisible(errorIcon, false)
        setVisible(canvas, false)

        setVisible(resetBtn, false)
        setVisible(tryAgainBtn, false)
        setVisible(randomCrowdBtn, false)
        setVisible(shareBtnShort, false)
    } else if (shortFlowState === 'loading') {
        headerSpan.innerHTML = 'Wait a moment, we are mixing :)'
        centerText(true)
        setVisible(answerIcon, false)
        setVisible(resetIcon, false)

        setVisible(placeholder, true)
        setVisible(plus, false)
        setVisible(spinner, true)
        setVisible(errorIcon, false)
        setVisible(canvas, false)

        setVisible(resetBtn, false)
        setVisible(tryAgainBtn, false)
        setVisible(randomCrowdBtn, false)
        setVisible(shareBtnShort, false)
    } else if (shortFlowState === 'error') {
        headerSpan.innerHTML = 'Something went wrong :('
        centerText(true)
        setVisible(answerIcon, false)
        setVisible(resetIcon, false)

        setVisible(placeholder, true)
        setVisible(plus, false)
        setVisible(spinner, false)
        setVisible(errorIcon, true)
        setVisible(canvas, false)

        setVisible(resetBtn, true)
        setVisible(tryAgainBtn, true)
        setVisible(randomCrowdBtn, false)
        setVisible(shareBtnShort, false)
    } else if (shortFlowState === 'result') {
        headerSpan.innerHTML = 'Share and <b>tag friends</b>!'
        centerText(false)
        setVisible(answerIcon, true)
        setVisible(resetIcon, true)

        setVisible(placeholder, false)

        setVisible(resetBtn, false)
        setVisible(tryAgainBtn, false)
        setVisible(randomCrowdBtn, true)
        setVisible(shareBtnShort, true)
        setVisible(canvas, true)

        setTimeout(function () {
            shortFlowPinchZoom = activateZoomCanvas({
                canvas: canvas,
                path: LAST_DATA.url
            }, body)
        }, 200)
    } else {
        showAlert('Oops!', 'Seems like smth went wrong on our side. Reload is needed.', [{
            text: 'OK'
        }], function () {
            document.location.reload(true)
        })
    }
}

/*** SHORT FLOW ***/

function openFacesScreen() {
    if (Math.random() > 0.5) {
        openLongFacesScreen()
    } else {
        openShortFacesScreen()
    }
}

function openShortFacesScreen() {
    openShortFlowScreen()
}

function openLongFacesScreen() {
    generateCrowdPhotosList()

    if (screensStack.length > 0) {
        setVisible(screensStack[0].div, false)
    }
    screensStack.length = 0
    updateFacesScreenUI()
    pushScreen('facesScreen')
}

function selectFacePhoto() {
    selectNativePhoto(function (photo) {
        pushFacePhoto(photo)
        updateFacesScreenUI()

        yaReachGoal('facePhoto')
    })
}

function selectCrowdPhoto() {
    selectNativePhoto(function (photo) {
        crowdPhoto = createPhotoObject(photo)

        openCookingScreen()

        yaReachGoal('myCrowdPhoto')
    })
}

function pushFacePhoto(photo) {
    facesPhotos.push(photo)

    var body = document.querySelector('#facesScreen .contentBody')

    var spinner = document.createElement('div')
    spinner.classList.add('geneSpinner')
    spinner.innerHTML = 'Loading...'

    // 58 header
    // 50 footer
    // 20 margin
    // 50 - na vsyakii
    var maxContainerHeight = window.innerHeight - 58 - 50 - 20 - 50
    maxContainerHeight = maxContainerHeight / 2

    var containerDiv = document.createElement('div')
    containerDiv.classList.add('facePhotoContainer')
    containerDiv.style.height = maxContainerHeight + 'px'
    containerDiv.appendChild(spinner)

    facesDiv.appendChild(containerDiv)

    var img = new Image()
    img.addEventListener('load', function () {
        var maxHeight = (body.getBoundingClientRect().height - 20) / 2
        var maxWidth = body.getBoundingClientRect().width
        var canvas = createCanvasFromImageAndTransforms(photo, img, containerDiv, maxWidth, maxHeight)

        setTimeout(function () {
            containerDiv.innerHTML = ''
            containerDiv.appendChild(canvas)
            setTimeout(function () {
                canvas.style.opacity = '1'
                
                var remove = document.createElement('div')
                remove.classList.add('facePhotoContainerRemove')
                remove.addEventListener('click', function () {
                    yaReachGoal('removefacePhoto')
                    facesPhotos = facesPhotos.filter(function (p) { return p.id !== photo.id })
                    facesDiv.removeChild(containerDiv)
                    updateFacesScreenUI()
                })
                containerDiv.appendChild(remove)
            }, 10)
        }, 200)
    })
    img.src = photo.url

    facesDiv.appendChild(containerDiv)
}

function updateFacesScreenUI() {
    var buttons = document.querySelector('#facesScreen .actionButtons')
    setVisible(buttons, facesPhotos.length > 0)

    var plus = document.querySelector('#facesScreen .genePlus')
    setVisible(plus, facesPhotos.length < 2)
}

function selectNativePhoto(onPhotoSelected) {
    if (!IS_PRODUCTION_WRAPPER) {
        var url = Math.random() > 0.5
            ? 'https://s16.stc.all.kpcdn.net/share/i/12/10577981/inx960x640.jpg'
            : 'https://1.bp.blogspot.com/-9QM7ciGXRkQ/V1hsB-wNLBI/AAAAAAAAMoA/eYbSHs00PTAjrI4QAmvYAIGCUe1AuRAnwCLcB/s1600/bryan_cranston_0095.jpg'

        var photo = createPhotoObject({
            url: url/*,
            crop: [0, 0.4, 1, 0.9],
            rotation: 180*/
        })
        onPhotoSelected(photo)
        return
    }

    var callback = 'nativePhotoSelected'
    window[callback] = function (result) {
        var photos = result.photos
        var photo = photos[0]
        if (photo) {
            onPhotoSelected(createPhotoObject(photo))
        }
    }
    location.href = 'callback:nativePhotoSelect?func=' + callback
}

function openCrowdScreen() {
    pushScreen('crowdScreen')
}

function createCanvasFromImageAndTransforms(photo, img, container, maxWidth, maxHeight) {
    var sx = 0
    var sy = 0
    var sw = img.width
    var sh = img.height
    var wScale = 1
    var hScale = 1
    if (photo.crop && photo.crop.length === 4) {
        var tx = photo.crop[0]
        var ty = photo.crop[1]
        var bx = photo.crop[2]
        var by = photo.crop[3]

        wScale = bx - tx
        hScale = by - ty

        sx = img.width * tx
        sy = img.height * ty
        sw = img.width * (bx - tx)
        sh = img.height * (by - ty)
    }

    var imgWidth = img.width
    var imgHeight = img.height
    var width = img.width * wScale
    var height = img.height * hScale
    var switchSizes = photo.rotation === 90 || photo.rotation === 270
    if (switchSizes) {
        var a = width
        width = height
        height = a
    }

    var scale = width > maxWidth ? maxWidth / width : 1
    if (height * scale > maxHeight) {
        scale *= maxHeight / (height * scale)
    }

    height *= scale
    width *= scale
    imgWidth *= scale
    imgHeight *= scale

    var canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'

    var ctx = canvas.getContext('2d')
    var horisScale = 1
    var vertScale = 1
    if (photo.flip === 1 || photo.flip === 3) {
        vertScale = -1
    }
    if (photo.flip === 2 || photo.flip === 3) {
        horisScale = -1
    }

    ctx.setTransform(horisScale, 0, 0, vertScale, width, height)
    ctx.rotate(photo.rotation * Math.PI / 180)

    var sx = 0
    var sy = 0
    var sw = img.width
    var sh = img.height
    if (photo.crop && photo.crop.length === 4) {
        var tx = photo.crop[0]
        var ty = photo.crop[1]
        var bx = photo.crop[2]
        var by = photo.crop[3]

        wScale = bx - tx
        hScale = by - ty

        sx = img.width * tx
        sy = img.height * ty
        sw = img.width * (bx - tx)
        sh = img.height * (by - ty)
    }
    ctx.drawImage(img, sx, sy, sw, sh, -width, -height, width * 2, height * 2)

    container.style.width = width + 'px'
    container.style.height = height + 'px'

    return canvas
}

function openCookingScreen() {
    var cookingFaces = document.getElementById('cookingFaces')
    cookingFaces.innerHTML = ''

    var cookingCrowd = document.getElementById('cookingCrowd')
    cookingCrowd.innerHTML = ''

    var createPhotoWrapper = function (photo, img, container, maxWidth, maxHeight) {
        var imgContainer = document.createElement('div')
        imgContainer.classList.add('cookingPhotoContainer')

        var canvas = createCanvasFromImageAndTransforms(photo, img, imgContainer, maxWidth, maxHeight)
        imgContainer.appendChild(canvas)

        container.appendChild(imgContainer)
    }

    var processPhoto = function (photo) {
        var img = new Image()
        img.addEventListener('load', function () {
            var bRect = cookingFaces.getBoundingClientRect()
            var maxWidth = bRect.width
            if (facesPhotos.length > 1) {
                maxWidth = bRect.width * 0.45
            }
            var maxHeight = bRect.height
            createPhotoWrapper(photo, img, cookingFaces, maxWidth, maxHeight)
        })
        img.src = photo.url
    }

    for (var i = 0; i < facesPhotos.length; i++) {
        processPhoto(facesPhotos[i])
    }

    var crowdImage = new Image()
    crowdImage.addEventListener('load', function () {
        var bRect = cookingCrowd.getBoundingClientRect()
        var maxWidth = bRect.width
        var maxHeight = bRect.height
        createPhotoWrapper(crowdPhoto, crowdImage, cookingCrowd, maxWidth, maxHeight)
    })
    crowdImage.src = crowdPhoto.url

    pushScreen('cookingScreen', function () {
        mixBtn.classList.remove('loading')
        mixId++
    })
}

function mixSelectedPhotos() {
    if (mixBtn.classList.contains('loading')) {
        return
    }

    yaReachGoal('mix')

    mixId++

    var thisMixId = mixId

    mixBtn.classList.add('loading')

    sendRequestToServer().then(function (data) {
        if (thisMixId !== mixId) {
            return
        }

        LAST_DATA = data

        if (data.error) {
            mixBtn.classList.remove('loading')

            if (data.reason === 'no_faces') {
                showAlert('Oops!', 'Seems like there are no faces on some of your photos. Please, check your photos.', [{
                    text: 'OK'
                }])
            } else {
                showAlert('Oops!', 'Seems like smth went wrong on our side. Please, try again. If problem persists, please, try another photos.', [{
                    text: 'Cancel',
                    passive: true
                }, {
                    text: 'Try again',
                    onClick: mixSelectedPhotos
                }])
            }
        } else {
            var img = new Image()
            img.addEventListener('load', function () {
                mixBtn.classList.remove('loading')
                openResultScreen(data, img)
            })
            img.src = data.url
        }
    })
    .catch(function (error) {
        if (thisMixId !== mixId) {
            return
        }

        mixBtn.classList.remove('loading')

        showAlert('Oops!', 'Seems like smth went wrong on our side. Please, try again.', [{
            text: 'Cancel',
            passive: true
        }, {
            text: 'Try again',
            onClick: mixSelectedPhotos
        }])
    })
}

function sendRequestToServer() {
    var payload = {
        me: facesPhotos[0],
        friend: facesPhotos[1],
        crowd: crowdPhoto
    }

    var host = USE_TEST_SERVER ? 'http://192.168.88.8:8080' : SERVER_ORIGIN

    return fetch(host + '/create_mix?data=' + JSON.stringify(payload))
        .then(function (resp) { return resp.json() })
}

function openResultScreen(data, imgObject) {
    answerBtn = document.querySelector('#resultScreen #answerBtn')
    answerBtn.classList.remove('answerIsVisible')

    var pinchZoom
    var destroyed = false

    var body = document.querySelector('#resultScreen .contentBody')
    body.innerHTML = ''

    var canvas = document.createElement('canvas')
    body.appendChild(canvas)

    var removeTipsFunc

    setTimeout(function () {
        if (destroyed) {
            return
        }

        pinchZoom = activateZoomCanvas({
            canvas: canvas,
            imgObject: imgObject
        }, body)
    }, 200)

    resultWasShared = false
    pushScreen('resultScreen', function () {
        LAST_DATA = undefined
        destroyed = true
        if (pinchZoom) {
            pinchZoom.destroy()
            pinchZoom = undefined
        }
    })
}

function activateZoomCanvas(params, body) {
    var removeTipsFunc

    var pinchZoom = new PinchZoomCanvas({
        canvas: params.canvas,
        path: LAST_DATA.url,
        imgObject: params.imgObject,
        momentum: true,
        onZoom: function () {
            showZoomTip = false

            if (removeTipsFunc) {
                removeTipsFunc()
                removeTipsFunc = undefined
            }
        },
        onRender: function () {
            if (answerIsVisible && pinchZoom) {
                var dx = pinchZoom.position.x
                var dy = pinchZoom.position.y
                var dw = pinchZoom.scale.x * pinchZoom.imgTexture.width
                var dh = pinchZoom.scale.y * pinchZoom.imgTexture.height
                pinchZoom.context.fillStyle = 'rgba(255, 255, 255, 0.6)'
                pinchZoom.context.fillRect(dx, dy, dw, dh)

                LAST_DATA.bboxs.forEach(function (bbox) {
                    var x = bbox[0]
                    var y = bbox[1]
                    var w = bbox[2] - x
                    var h = bbox[3] - y
                    var bdx = dx + x * pinchZoom.scale.x
                    var bdy = dy + y * pinchZoom.scale.y
                    var bdw = w * pinchZoom.scale.x
                    var bdh = h * pinchZoom.scale.y
                    pinchZoom.context.drawImage(pinchZoom.imgTexture, x, y, w, h, bdx, bdy, bdw, bdh)
                    pinchZoom.context.lineWidth = 2.5 * pinchZoom.scale.x
                    pinchZoom.context.strokeStyle = '#2a79ff'
                    pinchZoom.context.roundRect(bdx, bdy, bdw, bdh, 2 * pinchZoom.scale.x).stroke()
                })
            }
        }
    })

    setTimeout(function () {
        params.canvas.style.opacity = '1'

        if (showZoomTip) {
            var arrowLeft = new Image()
            arrowLeft.classList.add('leftArrowTip')
            arrowLeft.src = '/static/img/arrow-long-left.svg'
            arrowLeft.style.bottom = (pinchZoom.initPosition.y / 2 - 14) + 'px'

            var arrowRight = new Image()
            arrowRight.classList.add('rightArrowTip')
            arrowRight.src = '/static/img/arrow-long-left.svg'
            arrowRight.style.top = (pinchZoom.initPosition.y / 2 - 13) + 'px'

            body.appendChild(arrowLeft)
            body.appendChild(arrowRight)

            removeTipsFunc = function () {
                body.removeChild(arrowLeft)
                body.removeChild(arrowRight)
            }
        }
    }, 100)

    return pinchZoom
}

function onShareButtonClick() {
    shareResult(LAST_DATA, 'tryingToShare')
}

function onAnswerClick() {
    answerIsVisible = !answerIsVisible
    if (answerIsVisible) {
        answerBtn.classList.add('answerIsVisible')
    } else {
        answerBtn.classList.remove('answerIsVisible')
    }
}

function shareResult(data, eventName) {
    var callbackName = 'nativeShareCallback'
    window[callbackName] = function (result) {
        if (result) {
            resultWasShared = true
            yaReachGoal('shared')
        } else {
            resultWasShared = false
            yaReachGoal('notShared')
        }
    }

    yaReachGoal(eventName)

    var title = data.title || 'Find yourself in the crowd!'
    var description = '#secretsout challenge'
    var btnText = 'Place your photo in a crowd'

    var link = 'callback:nativeShare?og_image=' + encodeURIComponent(data.url) +
        '&og_title=' + encodeURIComponent(title) +
        '&og_description=' + encodeURIComponent(description) + 
        '&lp_button_cta=' + encodeURIComponent(btnText) +
        '&func=' + callbackName
    location.href = link
}

function backFromResult() {
    if (tryShowAlertThatResultWillBeLost(backFromResult)) {
        return
    }

    popScreen()
    popScreen()
}

function tryShowAlertThatResultWillBeLost(callback) {
    if (resultWasShared) {
        return false
    }

    if (!LAST_DATA) {
        return false
    }

    var title = 'Attention!'
    var description = 'Current mix will be lost. Wanna save it on your facebook?'

    showAlert(title, description, [{
        text: "I don't care",
        passive: true,
        onClick: function () {
            resultWasShared = true
            callback()
            yaReachGoal('iDontCare')
        }
    }, {
        text: 'Share',
        onClick: function () {
            shareResult(data, 'tryingToShareFromAlert')
        }
    }])

    return true
}

function safeExec(callback, defaultValue) {
    try {
        return callback()
    } catch(e) {
        return defaultValue
    }
}

function showAlert(title, description, buttons, onClose) {
    var closeAlert
    var titleDiv = document.createElement('div')
    titleDiv.classList.add('geneAlertTitle')
    titleDiv.innerHTML = title

    var descriptionDiv = document.createElement('div')
    descriptionDiv.classList.add('geneAlertDescription')
    descriptionDiv.innerHTML = description

    var closeAlert = function () {
        overlay.style.opacity = '0'
        setTimeout(function () {
            if (onClose) {
                onClose()
            }
            document.body.removeChild(overlay)
        }, 100)
    }

    var buttonsDiv = document.createElement('div')
    buttonsDiv.classList.add('geneAlertButtons')
    buttons.forEach(function (button) {
        var btnDiv = document.createElement('div')
        btnDiv.classList.add('geneBtn')
        if (button.passive) {
            btnDiv.classList.add('bordered')
        }
        btnDiv.innerHTML = button.text
        btnDiv.addEventListener('click', function (e) {
            e.stopPropagation()

            if (button.onClick) {
                button.onClick()
            }
            if (closeAlert) {
                closeAlert()
            }
        })
        buttonsDiv.appendChild(btnDiv)
    })

    var box = document.createElement('div')
    box.classList.add('geneAlert')
    box.appendChild(titleDiv)
    box.appendChild(descriptionDiv)
    box.appendChild(buttonsDiv)

    var overlay = document.createElement('div')
    overlay.classList.add('geneOverlay')
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    closeAlert = function () {
        overlay.style.opacity = '0'
        setTimeout(function () {
            document.body.removeChild(overlay)
        }, 100)
    }
    overlay.addEventListener('click', closeAlert)

    setTimeout(function () {
        overlay.style.opacity = '1'
    }, 10)
}

function generateCrowdPhotosList() {
    if (crowdListGenerated) {
        return
    }

    crowdListGenerated = true

    var crowdList = document.querySelector('.crowdList')
    CROWD_PHOTOS_LIST.forEach(function (photo) {
        var img = new Image()
        img.src = photo.url
        img.addEventListener('click', function () {
            crowdPhoto = createPhotoObject({
                url: photo.url
            })
            yaReachGoal('crowdPhoto' + photo.id)
            openCookingScreen()
        })

        crowdList.appendChild(img)
    })
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]')
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)')
    var results = regex.exec(location.search)
    return results === null ? '' : decodeURIComponent(results[1])
}

openStartScreen()
