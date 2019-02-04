import os
import re
import gc
import time
load_start = time.time()
import random
import requests
from io import BytesIO
from shutil import rmtree
import multiprocessing
from datetime import timedelta
from functools import update_wrapper
import json

import dlib
import numpy as np
import cv2
from PIL import Image, ExifTags
from scipy.spatial import distance
from flask import Flask, jsonify, render_template, request, send_file, url_for

import boto3
os.environ['AWS_PROFILE'] = "photo-hack-gene"

from face_swap import warp_image_2d, warp_image_3d, mask_from_points, \
                      apply_mask, correct_colours, transformation_from_points
#from utils import *

def convertDtypeRec(dd):
    dtype = type(dd)
    if dtype == list:
        for i in range(len(dd)):
            try:
                dd[i] = dd[i].item()
            except:
                convertDtypeRec(dd[i])
    else:
        try:
            dd = dd.item()
        except:
            pass

def open_img(url, biggest=400, flip_colors=False):

    response = requests.get(url)
    with BytesIO(response.content) as stream:
        image=Image.open(stream)
        try: 
            for orientation in ExifTags.TAGS.keys():
                if ExifTags.TAGS[orientation]=='Orientation':
                    break
            exif=dict(image._getexif().items())

            if exif[orientation] == 3:
                image=image.rotate(180, expand=True)
            elif exif[orientation] == 6:
                image=image.rotate(270, expand=True)
            elif exif[orientation] == 8:
                image=image.rotate(90, expand=True)

        except (AttributeError, KeyError, IndexError):
            # cases: image don't have getexif
            pass

        # convert to opencv format
        cv_image = np.array(image.convert('RGB'))
        image.close()

    cv_image = cv_image[:, :, ::-1].copy()
    if flip_colors:
        cv_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
    scale = biggest / max(cv_image.shape[:-1]) 
    old_shape = cv_image.shape[:-1][::-1]
    cv_image = cv2.resize(cv_image, (int(cv_image.shape[1]*scale), 
                     int(cv_image.shape[0]*scale)), Image.LANCZOS)
    return cv_image, old_shape

def read_file_buffer(f):
    img = f.read()
    img = np.fromstring(img, np.uint8)
    return cv2.imdecode(img, cv2.IMREAD_COLOR)

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

def calc_dist(img0, img1):
    return distance.euclidean(img0, img1)

def get_selfie_bboxs(me):
    my_bboxs = np.array(face_detection(me[0]))
    # points on the faces to be swapped (selfies / friends photos)
    if me[1] is not None:
        to_keep = []
        for arg in me[1]:
            for j, bbox in enumerate(my_bboxs):
                if (bbox[0] <= arg[0] <= bbox[2]) and \
                   (bbox[1] <= arg[1] <= bbox[3]):
                        to_keep.append(j)
        my_bboxs = my_bboxs[to_keep]
    return my_bboxs

def chunker(l, n):
    length = len(l)
    n = length // n
    for i in range(0, length, n):
        if length - i < 2*n:
            yield l[i:]
            break
        else:
            yield l[i:i + n]

class preprocess_img:

    def __init__(self, max_dst_boxes=25, embeddings_max_iters=2, n_jobs=2):

        self.max_dst_boxes = max_dst_boxes
        self.embeddings_max_iters = embeddings_max_iters
        self.n_jobs = n_jobs

    def face_points_detection(self, img, bbox):
        # Get the landmarks/parts for the face in box d.
        shape = PREDICTOR(img, bbox)

        # loop over the 68 facial landmarks and convert them
        # to a 2-tuple of (x, y)-coordinates
        coords = [(shape.part(i).x, shape.part(i).y) for i in range(68)]

        # return the list of (x, y)-coordinates
        return coords

    def select_faces(self, im, bbox, r=10):
        points = self.face_points_detection(im, dlib.rectangle(*bbox))
        im_w, im_h = im.shape[:2]
        left, top = np.min(points, 0)
        right, bottom = np.max(points, 0)
        
        x, y = max(0, left-r), max(0, top-r)
        w, h = min(right+r, im_h)-x, min(bottom+r, im_w)-y

        return points - np.asarray([[x, y]]), (x, y, w, h), im[y:y+h, x:x+w]

    def run(self, crowd, selfies):
        #args is a list of tuples: (img, points)
       
        self.crowd = crowd

        selfies_boxes = []
        for selfie in selfies:
            if selfie[0] is None:
                continue
            selfies_boxes.append(get_selfie_bboxs(selfie))

        selfies_boxes_len = sum([len(my_bboxs) for my_bboxs in selfies_boxes])
        self.bboxs = np.array(face_detection(crowd))
        if len(self.bboxs) == 0 or selfies_boxes_len == 0:
            return None

        random_sample_bboxs = np.random.choice(list(range(len(self.bboxs))), 
                                               size=min(len(self.bboxs), self.max_dst_boxes))
        random_sample_my_bboxs = np.random.choice(list(range(selfies_boxes_len)), 
                                               size=min(selfies_boxes_len, self.max_dst_boxes))

        if len(random_sample_bboxs) < len(self.bboxs):
            self.bboxs = self.bboxs[random_sample_bboxs]

        if len(random_sample_my_bboxs) < selfies_boxes_len:
            my_bboxs = my_bboxs[random_sample_my_bboxs]

        if len(self.bboxs) < 2:
            self.n_jobs = 1
            
        out, self.ignore_list = [], []
        for img_num, selfie in enumerate(selfies):
            if selfie[0] is None:
                continue
            my_bboxs = selfies_boxes[img_num]
            for i in range(len(my_bboxs)):
                self.src_face_descriptor = FACEREC.compute_face_descriptor(selfie[0], 
                                      SP(selfie[0], dlib.rectangle(*my_bboxs[i])), self.embeddings_max_iters)

                if self.n_jobs == 1:
                    dsts = np.full(len(self.bboxs), np.inf)
                    for j, bbox in enumerate(self.bboxs):
                        if j in self.ignore_list:
                            continue
                        face_descriptor = FACEREC.compute_face_descriptor(self.crowd,
                                          SP(self.crowd, dlib.rectangle(*bbox)), self.embeddings_max_iters)
                        dsts[j] = calc_dist(self.src_face_descriptor, face_descriptor)
                else:
                    manager = multiprocessing.Manager()
                    pool = multiprocessing.Pool(self.n_jobs)
                    res = manager.list([0] * self.n_jobs)
                    chunks = list(chunker(list(range(len(self.bboxs))), self.n_jobs))
                    pool.map(self.run_comparison, [(j, chunks[j], res) for j in range(self.n_jobs)])
                    dsts = np.concatenate([res[j] for j in range(self.n_jobs)], axis=0)
                    pool.close()
                    gc.collect()

                clst = np.argmin(dsts)
                self.ignore_list.append(clst)
                out.append((self.select_faces(self.crowd, self.bboxs[clst]), self.select_faces(selfie[0], my_bboxs[i])))
        del self.crowd; del self.bboxs; gc.collect()
        self.crowd = None; self.bboxs = None;
        return out
    
    def run_comparison(self, args):
        k, chunk, res = args
        dsts = np.full(len(chunk), np.inf)
        for l, m in enumerate(chunk):
            if m in self.ignore_list:
                continue
            face_descriptor = FACEREC.compute_face_descriptor(self.crowd,
                              SP(self.crowd, dlib.rectangle(*self.bboxs[m])), self.embeddings_max_iters)
            dsts[l] = calc_dist(self.src_face_descriptor, face_descriptor)
        res[k] = dsts
        del dsts; gc.collect()

def insert_face(result, CROWD):
    
    if result is None:
        return None
 
    result_bboxs = []
    for faces in result:
        dst_points, dst_shape, dst_face = faces[0]
        src_points, src_shape, src_face = faces[1]

        w, h = dst_face.shape[:2]

        ### Warp Image
        if not WARP_2D:
            ## 3d warp
            warped_src_face = warp_image_3d(src_face, src_points[:MAX_POINTS], dst_points[:MAX_POINTS], (w, h))
        else:
            ## 2d warp
            src_mask = mask_from_points(src_face.shape[:2], src_points, radius=2)
            src_face = apply_mask(src_face, src_mask)
            # Correct Color for 2d warp
            if CORRECT_COLOR:
                warped_dst_img = warp_image_3d(dst_face, dst_points[:MAX_POINTS], 
                                               src_points[:MAX_POINTS], src_face.shape[:2])
                src_face = correct_colours(warped_dst_img, src_face, src_points)
            # Warp
            warped_src_face = warp_image_2d(src_face, transformation_from_points(dst_points, src_points), (w, h, 3))

        ## Mask for blending
        mask = mask_from_points((w, h), dst_points, radius=2)
        mask_src = np.mean(warped_src_face, axis=2) > 0
        mask = np.asarray(mask*mask_src, dtype=np.uint8)

        ## Correct color
        if not WARP_2D and CORRECT_COLOR:
            warped_src_face = apply_mask(warped_src_face, mask)
            dst_face_masked = apply_mask(dst_face, mask)
            warped_src_face = correct_colours(dst_face_masked, warped_src_face, dst_points)

        ##Poisson Blending
        r = cv2.boundingRect(mask)
        center = ((r[0] + int(r[2] / 2), r[1] + int(r[3] / 2)))
        output = cv2.seamlessClone(warped_src_face, dst_face, mask, center, cv2.NORMAL_CLONE)

        x, y, w, h = dst_shape
        result_bboxs.append((x, y, x+w, y+h))
        CROWD[y:y+h, x:x+w] = output
    
    return CROWD, result_bboxs

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

#######################################################################################################


MAX_SIZE_SELFIE = 400 
MAX_SIZE_CROWD = 1000
WARP_2D = False
CORRECT_COLOR = True
MAX_POINTS = 58

BUCKET_NAME = "storage.ws.pho.to"
PATH = "photohack/gene"

#load trained models
# face landmarks
PREDICTOR = dlib.shape_predictor('./models/shape_predictor_68_face_landmarks.dat')
# dlib face recognition
SP = dlib.shape_predictor("./models/shape_predictor_5_face_landmarks.dat")
FACEREC = dlib.face_recognition_model_v1("./models/dlib_face_recognition_resnet_model_v1.dat")


#######################################################################################################

app = Flask(__name__)

print(f" [INFO] Server loaded! {int((time.time() - load_start) * 1000)} ms. ")

@app.route('/')
def hello_world():
    return render_template('index3.html')

@app.route('/create_mix',  methods=['GET', 'POST'])
def create_mix(): 
    responses = {} 
    friend, points_me, points_friend = None, None, None
    processor = preprocess_img(max_dst_boxes=15, embeddings_max_iters=2, n_jobs=2)
    
    input_urls = json.loads(request.values["data"])
    me, _ = open_img(input_urls["me"]["url"], biggest=MAX_SIZE_SELFIE)
    if "points" in input_urls["me"]:
        points_me = input_urls["me"]["points"]
    print(f" [INFO] Selfie shape: {me.shape}")
    crowd, old_shape = open_img(input_urls["crowd"]["url"], biggest=MAX_SIZE_CROWD)
    print(f" [INFO] Crowd shape: {crowd.shape}")
    if "friend" in input_urls:
        friend, _ = open_img(input_urls["friend"]["url"], biggest=MAX_SIZE_SELFIE)
        if "points" in input_urls["friend"]:
            points_friend = input_urls["friend"]["points"]
        print(f" [INFO] Friend photo shape: {friend.shape}")

    start = time.time() 
    #mix
    result = processor.run(crowd, [(me, points_me), 
                                   (friend, points_friend)])
    CROWD, result_bboxs = insert_face(result, crowd)
    responses["bboxs"] = str(result_bboxs)
    if result_bboxs is None:
        print(" [INFO] Something went wrong :( ")
        #return render_template('index.html', created_success=False, init=True)

    crowd = cv2.resize(crowd, old_shape, Image.LANCZOS)
    crowd = cv2.cvtColor(crowd, cv2.COLOR_BGR2RGB)
    retval, buff = cv2.imencode('.jpeg', crowd)

    s3 = boto3.client('s3')
    fname = PATH+"/"+str(random.randint(0,10e12))+".jpeg"

    with BytesIO(buff) as f:
        s3.upload_fileobj(f, BUCKET_NAME, fname, 
                          ExtraArgs={"ACL":'public-read', "StorageClass":'STANDARD'})

    responses["url"] = f"https://storage.ws.pho.to/{fname}"

    print(f" [INFO] Time consumed:  {int((time.time() - start) * 1000)} ms. ")

    for key in responses:
        convertDtypeRec(responses[key])

    responses = jsonify(responses)
    responses.status_code = 200 

    gc.collect()

    return responses

