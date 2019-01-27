import os
from flask import Flask, render_template, request, send_file
from PIL import Image
import numpy as np

app = Flask(__name__)
app.debug=True

UPLOAD_FOLDER_SELFIE = os.path.basename('images_selfie')
UPLOAD_FOLDER_CROWD = os.path.basename('images_crowd')
UPLOAD_FOLDER_MIX = os.path.basename('mix')
UPLOAD_FOLDER_ANSWER = os.path.basename('answer')
app.config['UPLOAD_FOLDER_SELFIE'] = UPLOAD_FOLDER_SELFIE
app.config['UPLOAD_FOLDER_CROWD'] = UPLOAD_FOLDER_CROWD
app.config['UPLOAD_FOLDER_MIX'] = UPLOAD_FOLDER_MIX
app.config['UPLOAD_FOLDER_ANSWER'] = UPLOAD_FOLDER_ANSWER

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
    file_for_save = open("file_selfie.txt","w+")
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
    file_for_save = open("file_crowd.txt","w+")
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
    im_selfie = Image.open(file_selfie)
    im_crowd = Image.open(file_crowd)

    im = im_crowd
    file = os.path.join(app.config['UPLOAD_FOLDER_MIX'])
    if not os.path.exists(file):
        os.makedirs(file)
    im.save(file + "/result", "JPEG")
	# save answer
    file_answer = os.path.join(app.config['UPLOAD_FOLDER_ANSWER'])
    if not os.path.exists(file_answer):
        os.makedirs(file_answer)
    im1 = im_crowd
    im1.save(file_answer + "/answer", "JPEG")
    return render_template('index.html', created_success=True, init=True)

@app.route('/show_answer',  methods=['GET', 'POST'])
def show_answer():
    return render_template('index.html', show_answer=True, init=True)




#if __name__ == '__main__':
#    app.run(host='0.0.0.0', port=8888)
