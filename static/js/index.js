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

// TODO: подсказка что можно скейлить результат
// TODO: query params для скриптов! на каждый чендж

// startScreen - первый экран с картинкой
// facesScreen - экран с лицами
// facePhoto - выбор фото. Не стал делать photo1, photo2, потому что нет понимания какая из них один, а какая два, потому что я могу удалить первую, и вторая станет первой, бла бла
// crowdScreen - экран с фотками толпы
// crowdPhoto + есть params {index: number}
// cookingScreen - экран с кнопкой mix
// mix - нажал кнопку микс
// resultScreen - экран результатов

var facePhotoId = 0
var mixId = 0
var facesPhotos = []
var crowdPhoto = createPhotoObject()

var showZoomTip = true
var shareBtn = document.getElementById('shareBtn')
var answerBtn = document.getElementById('answerBtn')
var mixBtn = document.getElementById('mixBtn')
var facesDiv = document.getElementById('facesDiv')
var progressSteps = document.getElementById('progressSteps')
var screensStack = []

function yaReachGoal(targetName, params) {
    ym(52246906, 'reachGoal', targetName)
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

function popScreen() {
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

    updateSteps()
}

function resetScreens() {
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
        popScreen()
    }
}

function openStartScreen() {
    pushScreen('startScreen')
}

function openFacesScreen() {
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
    })
}

function pushFacePhoto(photo) {
    facesPhotos.push(photo)

    var body = document.querySelector('#facesScreen .contentBody')

    var spinner = document.createElement('div')
    spinner.classList.add('geneSpinner')
    spinner.innerHTML = 'Loading...'

    var containerDiv = document.createElement('div')
    containerDiv.classList.add('facePhotoContainer')
    containerDiv.appendChild(spinner)

    facesDiv.appendChild(containerDiv)

    var img = new Image()
    img.addEventListener('load', function () {
        var maxHeight = (body.getBoundingClientRect().height - 20) / 2
        var maxWidth = body.getBoundingClientRect().width

        var canvas = createCanvasFromImageAndTransforms(photo, img, containerDiv, maxWidth, maxHeight)
        containerDiv.style.maxHeight = 'none'

        setTimeout(function () {
            containerDiv.innerHTML = ''
            containerDiv.appendChild(canvas)
            setTimeout(function () {
                canvas.style.opacity = '1'
                
                var remove = document.createElement('div')
                remove.classList.add('facePhotoContainerRemove')
                remove.addEventListener('click', function () {
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

function isLocalTest() {
    return location.host.indexOf('127.0.0.1') !== -1
}

function selectNativePhoto(onPhotoSelected) {
    if (isLocalTest()) {
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
            var maxWidth = bRect.width * 0.45
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

    var payload = {
        me: facesPhotos[0],
        friend: facesPhotos[1],
        crowd: crowdPhoto
    }

    fetch('http://gene.ws.pho.to/create_mix?data=' + JSON.stringify(payload))
    .then(function (resp) { return resp.json() })
    .then(function (data) {
        if (thisMixId !== mixId) {
            return
        }

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

function openResultScreen(data, imgObject) {
    var pinchZoom
    var destroyed = false

    var body = document.querySelector('#resultScreen .contentBody')
    body.innerHTML = ''

    var canvas = document.createElement('canvas')
    body.appendChild(canvas)

    var answerIsVisible = false
    var onAnswerClick = function () {
        answerIsVisible = !answerIsVisible
        if (answerIsVisible) {
            answerBtn.classList.add('answerIsVisible')
        } else {
            answerBtn.classList.remove('answerIsVisible')
        }
    }
    answerBtn.addEventListener('click', onAnswerClick)

    var onShareClick = function () {
        shareResult(data)
    }
    shareBtn.addEventListener('click', onShareClick)

    var removeTipsFunc

    setTimeout(function () {
        if (destroyed) {
            return
        }

        pinchZoom = new PinchZoomCanvas({
            canvas: canvas,
            path: data.url,
            imgObject: imgObject,
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

                    data.bboxs.forEach(function (bbox) {
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
            canvas.style.opacity = '1'

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

            /*if (data.bboxs && data.bboxs.length && pinchZoom) {
                var bbox = data.bboxs[0]
                var x = bbox[0]
                var y = bbox[1]
                var w = bbox[2] - x
                var h = bbox[3] - y
                var cx = x + w / 2
                var cy = y + h / 2

                var touchX = pinchZoom.initialScale * cx / 2 + pinchZoom.initPosition.x / 2
                var touchY = pinchZoom.initialScale * cy / 2 + pinchZoom.initPosition.y / 2

                var dx = pinchZoom.initialScale * w / 2
                var dy = pinchZoom.initialScale * h / 2

                var icx = pinchZoom.imgTexture.width / 2
                var icy = pinchZoom.imgTexture.height / 2
                touchX += cx > icx ? dx : -dx
                touchY += cy > icy ? dy : -dy

                var counter = 0
                var animate = function () {
                    if (pinchZoom) {
                        pinchZoom.lastTouchTime  = null;
                        pinchZoom.lastTouchPageX = 0;
                        pinchZoom.zoom(3, touchX, touchY)
                        pinchZoom._destroyImpetus();
                        pinchZoom._createImpetus();
                        if (counter < 10) {
                            counter++
                            requestAnimationFrame(animate)
                        } else {
                            onAnswerClick()
                        }
                    }
                }

                setTimeout(function () {
                    requestAnimationFrame(animate)
                }, 200)
            }*/

        }, 100)
    }, 200)

    pushScreen('resultScreen', function () {
        destroyed = true
        answerBtn.classList.remove('answerIsVisible')
        answerBtn.removeEventListener('click', onAnswerClick)
        shareBtn.removeEventListener('click', onShareClick)
        if (pinchZoom) {
            pinchZoom.destroy()
            pinchZoom = undefined
        }
    })
}

function shareResult(data) {
    var callbackName = 'nativeShareCallback'
    window[callbackName] = function (result) {
        if (result) {
            // shared
        } else {
            // not shared
        }
    }

    var title = data.title || 'Find yourself in the crowd!'
    var description = '#secretsout challenge'

    var link = 'callback:nativeShare?og_image=' + encodeURIComponent(data.url) +
        '&og_title=' + encodeURIComponent(title) +
        '&og_description=' + encodeURIComponent(description) + 
        '&func=' + callbackName
    location.href = link
}

function safeExec(callback, defaultValue) {
    try {
        return callback()
    } catch(e) {
        return defaultValue
    }
}

function showAlert(title, description, buttons) {
    var titleDiv = document.createElement('div')
    titleDiv.classList.add('geneAlertTitle')
    titleDiv.innerHTML = title

    var descriptionDiv = document.createElement('div')
    descriptionDiv.classList.add('geneAlertDescription')
    descriptionDiv.innerHTML = description

    var buttonsDiv = document.createElement('div')
    buttonsDiv.classList.add('geneAlertButtons')
    buttons.forEach(function (button) {
        var btnDiv = document.createElement('div')
        btnDiv.classList.add('geneBtn')
        if (button.passive) {
            btnDiv.classList.add('bordered')
        }
        btnDiv.innerHTML = button.text
        btnDiv.addEventListener('click', function () {
            if (button.onClick) {
                button.onClick()
            }
            overlay.style.opacity = '0'
            setTimeout(function () {
                document.body.removeChild(overlay)
            }, 100)
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

    setTimeout(function () {
        overlay.style.opacity = '1'
    }, 10)
}

// subscribe crowd photos click
var crowdPhotos = document.querySelectorAll('.crowdList img')
for (var i = 0; i < crowdPhotos.length; i++) {
    ;(function (i) {
        var photo = crowdPhotos[i]
            photo.addEventListener('click', function () {
                crowdPhoto = createPhotoObject({
                    url: photo.src
                })
                yaReachGoal('crowdPhoto', {
                    index: i
                })
                openCookingScreen()
            })
    }(i));
}

// open first screen
openStartScreen()
