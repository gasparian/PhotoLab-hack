import os
import re
import gc
import time
import random
from shutil import rmtree

import dlib
from PIL import Image
import numpy as np
#import matplotlib.pyplot as plt
#%matplotlib inline

from face_swap import warp_image_2d, warp_image_3d, mask_from_points, \
                      apply_mask, correct_colours, transformation_from_points

from flask import Flask, render_template, request, send_file, url_for
from PIL import Image
from datetime import timedelta
from functools import update_wrapper

import numpy as np
import cv2
from scipy.spatial import distance
#from utils import *

def open_img(img, biggest=400):
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    scale = biggest / max(img.shape[:-1]) 
    img = cv2.resize(img, (int(img.shape[1]*scale), int(img.shape[0]*scale)), Image.LANCZOS)
    return img

def face_detection(img):
    # Ask the detector to find the bounding boxes of each face. The 1 in the
    # second argument indicates that we should upsample the image 1 time. This
    # will make everything bigger and allow us to detect more faces.
    detector = dlib.get_frontal_face_detector()
    faces = detector(img, 1)
    bboxs = []

    for face in faces:
        bboxs.append((face.left(), face.top(), face.right(), face.bottom()))
    
    return bboxs

def face_points_detection(img, bbox):
    # Get the landmarks/parts for the face in box d.
    shape = predictor(img, bbox)

    # loop over the 68 facial landmarks and convert them
    # to a 2-tuple of (x, y)-coordinates
    coords = [(shape.part(i).x, shape.part(i).y) for i in range(68)]

    # return the list of (x, y)-coordinates
    return coords

def select_faces(im, bbox, r=10):
    points = face_points_detection(im, dlib.rectangle(*bbox))
    im_w, im_h = im.shape[:2]
    left, top = np.min(points, 0)
    right, bottom = np.max(points, 0)
    
    x, y = max(0, left-r), max(0, top-r)
    w, h = min(right+r, im_h)-x, min(bottom+r, im_w)-y

    return points - np.asarray([[x, y]]), (x, y, w, h), im[y:y+h, x:x+w]

def calc_dist(img0, img1):
    return distance.euclidean(img0, img1)

def preprocess_img(me, crowd, *args):
    
    # args is points on the faces to be swapped (selfies / friends photos)

    my_bboxs = face_detection(me)
    bboxs = np.array(face_detection(crowd))
    random_sample = np.random.choice(list(range(len(bboxs))), size=25)
    if len(random_sample) < len(bboxs):
        bboxs = bboxs[random_sample]
    src_face_descriptor = facerec.compute_face_descriptor(me, 
                          sp(me, dlib.rectangle(*my_bboxs[0])), 20)
    clst, i = (0, np.inf), 0
    for bbox in bboxs:
        face_descriptor = facerec.compute_face_descriptor(crowd, 
                           sp(crowd, dlib.rectangle(*bbox)), 20)
        dst = calc_dist(src_face_descriptor, face_descriptor)
        if dst < clst[1]:
            clst = (i, dst)
        i += 1
    return { "dst" : select_faces(crowd, bboxs[clst[0]]),
             "src" : select_faces(me, my_bboxs[0]) }

def insert_face(me, crowd):
    
    result = preprocess_img(me, crowd)
    dst_points, dst_shape, dst_face = result["dst"]
    src_points, src_shape, src_face = result["src"]
    del result; gc.collect()
    
    warp_2d = False
    correct_color = True
    max_points = 58
    
    w, h = dst_face.shape[:2]

    ### Warp Image
    if not warp_2d:
        ## 3d warp
        warped_src_face = warp_image_3d(src_face, src_points[:max_points], dst_points[:max_points], (w, h))
    else:
        ## 2d warp
        src_mask = mask_from_points(src_face.shape[:2], src_points, radius=2)
        src_face = apply_mask(src_face, src_mask)
        # Correct Color for 2d warp
        if correct_color:
            warped_dst_img = warp_image_3d(dst_face, dst_points[:max_points], 
                                           src_points[:max_points], src_face.shape[:2])
            src_face = correct_colours(warped_dst_img, src_face, src_points)
        # Warp
        warped_src_face = warp_image_2d(src_face, transformation_from_points(dst_points, src_points), (w, h, 3))

    ## Mask for blending
    mask = mask_from_points((w, h), dst_points, radius=2)
    mask_src = np.mean(warped_src_face, axis=2) > 0
    mask = np.asarray(mask*mask_src, dtype=np.uint8)

    ## Correct color
    if not warp_2d and correct_color:
        warped_src_face = apply_mask(warped_src_face, mask)
        dst_face_masked = apply_mask(dst_face, mask)
        warped_src_face = correct_colours(dst_face_masked, warped_src_face, dst_points)

    ##Poisson Blending
    r = cv2.boundingRect(mask)
    center = ((r[0] + int(r[2] / 2), r[1] + int(r[3] / 2)))
    output = cv2.seamlessClone(warped_src_face, dst_face, mask, center, cv2.NORMAL_CLONE)

    x, y, w, h = dst_shape
    dst_img_cp = crowd.copy()
    dst_img_cp[y:y+h, x:x+w] = output
    new_output = output.copy()
    output = dst_img_cp

    output_labeled = output.copy()
    cv2.rectangle(output_labeled, (x, y), (x+w, y+h), (255,0,0), 2)
    
    return output, output_labeled

def crossdomain(origin=None, methods=None, headers=None,
                max_age=21600, attach_to_all=True,
                automatic_options=True):
    if methods is not None:
        methods = ', '.join(sorted(x.upper() for x in methods))
    if headers is not None and not isinstance(headers, str):
        headers = ', '.join(x.upper() for x in headers)
    if not isinstance(origin, str):
        origin = ', '.join(origin)
    if isinstance(max_age, timedelta):
        max_age = max_age.total_seconds()

    def get_methods():
        if methods is not None:
            return methods

        options_resp = current_app.make_default_options_response()
        return options_resp.headers['allow']

    def decorator(f):
        def wrapped_function(*args, **kwargs):
            if automatic_options and request.method == 'OPTIONS':
                resp = current_app.make_default_options_response()
            else:
                resp = make_response(f(*args, **kwargs))
            if not attach_to_all and request.method != 'OPTIONS':
                return resp

            h = resp.headers
            h['Access-Control-Allow-Origin'] = origin
            h['Access-Control-Allow-Methods'] = get_methods()
            h['Access-Control-Max-Age'] = str(max_age)
            h['Access-Control-Allow-Credentials'] = 'true'
            h['Access-Control-Allow-Headers'] = \
                "Origin, X-Requested-With, Content-Type, Accept, Authorization"
            if headers is not None:
                h['Access-Control-Allow-Headers'] = headers
            return resp

        f.provide_automatic_options = False
        #f.required_methods = ['OPTIONS']
        return update_wrapper(wrapped_function, f)
    return decorator

#load trained models
# face landmarks
predictor = dlib.shape_predictor('./models/shape_predictor_68_face_landmarks.dat')
# dlib face recognition
sp = dlib.shape_predictor("./models/shape_predictor_5_face_landmarks.dat")
facerec = dlib.face_recognition_model_v1("./models/dlib_face_recognition_resnet_model_v1.dat")

app = Flask(__name__)
app.debug=True

UPLOAD_FOLDER_SELFIE = os.path.basename('images_selfie')
UPLOAD_FOLDER_CROWD = os.path.basename('images_crowd')
UPLOAD_FOLDER_MIX = os.path.basename('static')
UPLOAD_FOLDER_ANSWER = os.path.basename('static')
app.config['UPLOAD_FOLDER_SELFIE'] = UPLOAD_FOLDER_SELFIE
app.config['UPLOAD_FOLDER_CROWD'] = UPLOAD_FOLDER_CROWD
app.config['UPLOAD_FOLDER_MIX'] = UPLOAD_FOLDER_MIX
app.config['UPLOAD_FOLDER_ANSWER'] = UPLOAD_FOLDER_ANSWER

print(" [INFO] Server loaded! ")

@app.route('/')
def hello_world():
    return render_template('index.html')

@app.route('/upload_selfie', methods=['POST'])
def upload_file_selfie():
    file = request.files['image_selfie']
    if not os.path.exists(app.config['UPLOAD_FOLDER_SELFIE']):
        os.makedirs(app.config['UPLOAD_FOLDER_SELFIE'])
    f = os.path.join(app.config['UPLOAD_FOLDER_SELFIE'], file.filename)
    # add your custom code to check that the uploaded file is a valid image and not a malicious file (out-of-scope for this post)
    file.save(f)
    #cv2.imwrite(f, np.array(file))    

    file_for_save = open("file_selfie.txt","w")
    file_for_save.write(file.filename)
    file_for_save.close()
    return render_template('index.html', uploaded_selfie_success=True, init=True)

@app.route('/upload_crowd',  methods=['GET', 'POST'])
def upload_file_crowd():
    file = request.files['image_crowd']
    if not os.path.exists(app.config['UPLOAD_FOLDER_CROWD']):
        os.makedirs(app.config['UPLOAD_FOLDER_CROWD'])
    f = os.path.join(app.config['UPLOAD_FOLDER_CROWD'], file.filename)
    # add your custom code to check that the uploaded file is a valid image and not a malicious file (out-of-scope for this post)
    file.save(f)
    #cv2.imwrite(f, np.array(file))    

    file_for_save = open("file_crowd.txt","w")
    file_for_save.write(file.filename)
    file_for_save.close()
    return render_template('index.html', uploaded_crowd_success=True, init=True)

@app.route('/create_mix',  methods=['GET', 'POST'])
def upload_create_mix():
    file_saved_selfie = open("file_selfie.txt","r")
    file_selfie_str = str(file_saved_selfie.readline())
    file_saved_selfie.close()
    file_saved_crowd = open("file_crowd.txt","r")
    file_crowd_str = str(file_saved_crowd.readline())
    file_saved_crowd.close()
    file_selfie = os.path.join(app.config['UPLOAD_FOLDER_SELFIE'], file_selfie_str)
    file_crowd = os.path.join(app.config['UPLOAD_FOLDER_CROWD'], file_crowd_str)

    start = time.time() 
    me = np.array(Image.open(file_selfie))
    crowd = np.array(Image.open(file_crowd))
    me = open_img(me, biggest=400)

    # hack; must be deleted
    if me.shape[0] < me.shape[1]: 
        me = np.rot90(me)

    crowd = open_img(crowd, biggest=1200) 

    #main 
    output, output_labeled = insert_face(me, crowd)

    print(f" [INFO] Time consumed:  {int(time.time() - start) * 1000} ms. ")

    # save answer
    file = os.path.join(app.config['UPLOAD_FOLDER_MIX'])
    if not os.path.exists(file):
        os.makedirs(file)
    else:
        rmtree("./static/")
        os.makedirs(file)

    cv2.imwrite(file + "/result.jpeg", output)

    # save labeled answer
    file_answer = os.path.join(app.config['UPLOAD_FOLDER_ANSWER'])
    if not os.path.exists(file_answer):
        os.makedirs(file_answer)
    cv2.imwrite(file_answer + "/answer.jpeg", output_labeled)

    result_filename = url_for('static', filename='result.jpeg') + '?rnd=' + str(random.randint(0, 10e9))
    return render_template('index.html', created_success=True, init=True,
                           result_filename=result_filename)

@app.route('/show_answer',  methods=['GET', 'POST'])
def show_answer():
    answer_filename = url_for('static', filename='answer.jpeg') + '?rnd=' + str(random.randint(0, 10e9))
    return render_template('index.html', show_answer=True, init=True,
                           answer_filename=answer_filename)


@app.route('/', methods=['GET'])
@crossdomain(origin='*')
def healthcheck():
    return "OK"
