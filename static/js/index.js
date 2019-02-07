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

// TODO: онбординг? будет позже
// TODO: query params для скриптов! на каждый чендж

var ONBOARDING_KEY = 'ONBOARDING2'
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
    facesPhotos.forEach(function (photo) {
        if (photo.destroy) {
            photo.destroy()
        }
    })
    facesPhotos.length = 0
    crowdPhoto = {
        url: '',
        crop: [0, 0, 1, 1],
        rotation: 0,
        flip: 0
    }
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

        var photoParams = getPhotoTransformAndClip(photo)
        var imgWidth = img.width
        var imgHeight = img.height
        var width = img.width * photoParams.wScale
        var height = img.height * photoParams.hScale

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

        /*var canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'

        var ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height)*/

        containerDiv.style.maxHeight = 'auto'
        containerDiv.style.width = width + 'px'
        containerDiv.style.height = height + 'px'
        img.style.width = imgWidth + 'px'
        img.style.height = imgHeight + 'px'
        if (photoParams.transform) {
            img.style.transform = photoParams.transform
        }
        if (photoParams.clipPath) {
            img.style.clipPath = photoParams.clipPath
        }

        setTimeout(function () {
            containerDiv.innerHTML = ''
            //containerDiv.appendChild(canvas)
            containerDiv.appendChild(img)
            setTimeout(function () {
                img.style.opacity = '1'
                
                /*
                canvas.style.opacity = '1'

                var touches = []
                var pinchZoom = new PinchZoomCanvas({
                    canvas: canvas,
                    path: img.src,
                    imgObject: img,
                    momentum: true,
                    onClick: function (touch) {
                        var touchX = touch.pageX - pinchZoom.offeset.x
                        var touchY = touch.pageY - pinchZoom.offeset.y

                        var newTouches = []
                        for (var i = 0; i < touches.length; i++) {
                            var dx = touchX - touches[i].x
                            var dy = touchY - touches[i].y
                            var d = Math.sqrt(dx * dx + dy * dy)
                            if (d > 10) {
                                newTouches.push(touches[i])
                            }
                        }
                        if (newTouches.length === touches.length) {
                            touches.push({
                                x: touchX,
                                y: touchY
                            })
                        } else {
                            touches = newTouches
                        }
                        console.log('click', touch, canvas.getBoundingClientRect(), pinchZoom)
                    },
                    onRender: function () {
                        // WARN: render is valid. How to place NEW points correctly, when zoomed?
                        touches.forEach(function (touch) {
                            var x = touch.x / scale
                            var y = touch.y / scale

                            x *= pinchZoom.scale.x
                            y *= pinchZoom.scale.y

                            x += pinchZoom.position.x
                            y += pinchZoom.position.y
                            
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
                            ctx.beginPath()
                            ctx.arc(x, y, 14, 0, 2 * Math.PI)
                            ctx.fill()

                            ctx.fillStyle = '#2a79ff'
                            ctx.beginPath()
                            ctx.arc(x, y, 10, 0, 2 * Math.PI)
                            ctx.fill()
                        })
                    }
                })
                photo.destroy = function () {
                    pinchZoom.destroy()
                }*/
                var remove = document.createElement('div')
                remove.classList.add('facePhotoContainerRemove')
                remove.addEventListener('click', function () {
                    /*if (pinchZoom) {
                        pinchZoom.destroy()
                    }*/
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
            url: Math.random() > 0.5 ? 'https://s16.stc.all.kpcdn.net/share/i/12/10577981/inx960x640.jpg' : 'https://1.bp.blogspot.com/-9QM7ciGXRkQ/V1hsB-wNLBI/AAAAAAAAMoA/eYbSHs00PTAjrI4QAmvYAIGCUe1AuRAnwCLcB/s1600/bryan_cranston_0095.jpg',
            crop: [0, 0, 1, 1], //[0.2, 0, 0.8, 1],
            rotation: 0,//90,
            flip: 0,//3,
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

function getPhotoTransformAndClip(photo) {
    var transform = ''
    if (photo.rotation) {
        transform = 'rotate(' + -photo.rotation + 'deg)'
    }
    if (photo.flip === 1) {
        transform += ' scale(-1, 1)'
    }
    if (photo.flip === 2) {
        transform += ' scale(1, -1)'
    }
    if (photo.flip === 3) {
        transform += ' scale(-1, 1) scale(1, -1)'
    }

    var wScale = 1
    var hScale = 1
    var clipPath = ''
    if (photo.crop && photo.crop.length === 4) {
        var tx = photo.crop[0]
        var ty = photo.crop[1]
        var bx = photo.crop[2]
        var by = photo.crop[3]

        wScale = bx - tx
        hScale = by - ty

        var topLeft =     (tx * 100) + '% ' + (ty * 100) + '%'
        var topRight =    (bx * 100) + '% ' + (ty * 100) + '%'
        var bottomRight = (bx * 100) + '% ' + (by * 100) + '%'
        var bottomLeft =  (tx * 100) + '% ' + (by * 100) + '%'

        clipPath = 'polygon(' + topLeft + ', ' + topRight + ', ' + bottomRight + ', ' + bottomLeft + ')' 
    }

    return {
        transform: transform.trim(),
        clipPath: clipPath.trim(),
        wScale: wScale,
        hScale: hScale
    }
}

function openCrowdScreen() {
    pushScreen('crowdScreen')
}

function openCookingScreen() {
    var cookingFaces = document.getElementById('cookingFaces')
    cookingFaces.innerHTML = ''

    var cookingCrowd = document.getElementById('cookingCrowd')
    cookingCrowd.innerHTML = ''

    var processPhoto = function (photo) {
        var img = new Image()
        var photoParams = getPhotoTransformAndClip(photo)
        var switchSizes = photo.rotation === 90 || photo.rotation === 270

        img.addEventListener('load', function () {
            if (switchSizes) {
                photoParams.transform += ' scale(' + img.width / img.height + ')'
                photoParams.transform.trim()
            }
            if (photoParams.transform) {
                img.style.transform = photoParams.transform
            }
            if (photoParams.clipPath) {
                img.style.clipPath = photoParams.clipPath
            }

            cookingFaces.appendChild(img)
        })
        img.src = photo.url
    }

    for (var i = 0; i < facesPhotos.length; i++) {
        processPhoto(facesPhotos[i])
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
        shareResult(data.url, data.title)
    }
    shareBtn.addEventListener('click', onShareClick)

    setTimeout(function () {
        if (destroyed) {
            return
        }

        pinchZoom = new PinchZoomCanvas({
            canvas: canvas,
            path: data.url,
            imgObject: imgObject,
            momentum: true,
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

            if (data.bboxs && data.bboxs.length && pinchZoom) {
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
                                answerIsVisible = true
                            }
                        }
                    }

                    setTimeout(function () {
                        requestAnimationFrame(animate)
                    }, 200)
                }

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
                crowdPhoto.url = photo.src
                openCookingScreen()
            })
    }(i));
}

// open first screen
var onboardWasShown = safeExec(function () {
    return !!localStorage.getItem(ONBOARDING_KEY)
}, false)
if (onboardWasShown) {
    openFacesScreen()
} else {
    openStartScreen()

    safeExec(function () {
        localStorage.setItem(ONBOARDING_KEY, true)
    })
}

