import os
from flask import Flask, render_template, request, send_file
from PIL import Image
import numpy as np

app = Flask(__name__)
app.debug=True

UPLOAD_FOLDER_SELFIE = os.path.basename('uploads')
UPLOAD_FOLDER_CROWD = os.path.basename('images')
app.config['UPLOAD_FOLDER_SELFIE'] = UPLOAD_FOLDER_SELFIE
app.config['UPLOAD_FOLDER_CROWD'] = UPLOAD_FOLDER_CROWD

@app.route('/')
def hello_world():
    return render_template('index.html')

@app.route('/upload_selfie', methods=['POST'])
def upload_file_selfie():
    file = request.files['image']
    f = os.path.join(app.config['UPLOAD_FOLDER_SELFIE'], file.filename)
    
    # add your custom code to check that the uploaded file is a valid image and not a malicious file (out-of-scope for this post)
    file.save(f)

    return render_template('index.html', uploaded_selfie_success=True, init=True)

@app.route('/upload_crowd',  methods=['GET', 'POST'])
def upload_file_crowd():
    id_selected = request.form.get('id_selected')
    #filename = os.path.join(app.config['UPLOAD_FOLDER_CROWD'], str(id_selected) + '.jpg')
    filename = "./images/" + str(id_selected) + '.jpg'
	
    #here is script for image transform.
    #new_loc = os.path.join(app.config['UPLOAD_FOLDER_CROWD'], 'new.jpg')
	#im_new.save(new_loc,"PNG")
	
    return send_file(app.config['UPLOAD_FOLDER_CROWD']+"/"+str(id_selected) + '.jpg', 
					 as_attachment=True, 
					 attachment_filename=str(id_selected) + '.jpg')

if __name__ == '__main__':
    app.run()
