# This code is imported from the following project: https://github.com/asmith26/wide_resnets_keras

import logging
import sys
import numpy as np
from keras.models import Model
from keras.layers import Input, Activation, add, Dense, Flatten, Dropout, Multiply
from keras.layers.convolutional import Conv2D, AveragePooling2D, MaxPooling2D
from keras.layers.normalization import BatchNormalization
from keras.regularizers import l2
from keras import backend as K

sys.setrecursionlimit(2 ** 20)
np.random.seed(2 ** 10)


class TYY_2stream:
    def __init__(self, image_size):
        
        self._dropout_probability = 0
        self._weight_decay = 0.0005
        self._use_bias = False
        self._weight_init = "he_normal"

        if K.image_dim_ordering() == "th":
            logging.debug("image_dim_ordering = 'th'")
            self._channel_axis = 1
            self._input_shape = (3, image_size, image_size)
        else:
            logging.debug("image_dim_ordering = 'tf'")
            self._channel_axis = -1
            self._input_shape = (image_size, image_size, 3)


#    def create_model(self):
    def __call__(self):
        logging.debug("Creating model...")


        inputs = Input(shape=self._input_shape)

        x = Conv2D(32,(3,3),activation='relu')(inputs)
        x = MaxPooling2D(2,2)(x)
        x = Conv2D(32,(3,3),activation='relu')(x)
        x = MaxPooling2D(2,2)(x)
        x = Conv2D(64,(3,3),activation='relu')(x)
        

        y = Conv2D(32,(3,3),activation='relu')(inputs)
        y = MaxPooling2D(2,2)(y)
        y = Conv2D(32,(3,3),activation='relu')(y)
        y = MaxPooling2D(2,2)(y)
        y = Conv2D(64,(3,3),activation='tanh')(y)
        
        z = Multiply()([x,y])
        z = BatchNormalization(axis=self._channel_axis)(z)

        # Classifier block
        pool = AveragePooling2D(pool_size=(8, 8), strides=(1, 1), padding="same")(z)
        flatten = Flatten()(pool)
        predictions_g = Dense(units=2, kernel_initializer=self._weight_init, use_bias=self._use_bias,
                              kernel_regularizer=l2(self._weight_decay), activation="softmax")(flatten)
        predictions_a = Dense(units=21, kernel_initializer=self._weight_init, use_bias=self._use_bias,
                              kernel_regularizer=l2(self._weight_decay), activation="softmax")(flatten)

        model = Model(inputs=inputs, outputs=[predictions_g, predictions_a])



        return model

class TYY_1stream:
    def __init__(self, image_size):
        
        self._dropout_probability = 0
        self._weight_decay = 0.0005
        self._use_bias = False
        self._weight_init = "he_normal"

        if K.image_dim_ordering() == "th":
            logging.debug("image_dim_ordering = 'th'")
            self._channel_axis = 1
            self._input_shape = (3, image_size, image_size)
        else:
            logging.debug("image_dim_ordering = 'tf'")
            self._channel_axis = -1
            self._input_shape = (image_size, image_size, 3)


#    def create_model(self):
    def __call__(self):
        logging.debug("Creating model...")


        inputs = Input(shape=self._input_shape)

        x = Conv2D(32,(3,3),activation='relu')(inputs)
        x = MaxPooling2D(2,2)(x)
        x = Conv2D(32,(3,3),activation='relu')(x)
        x = MaxPooling2D(2,2)(x)
        x = Conv2D(64,(3,3),activation='relu')(x)
        x = MaxPooling2D(2,2)(x)
        x = Conv2D(64,(3,3),activation='relu')(x)
        x = BatchNormalization(axis=self._channel_axis)(x)

        # Classifier block
        pool = AveragePooling2D(pool_size=(4, 4), strides=(1, 1), padding="same")(x)
        flatten = Flatten()(pool)
        predictions_g = Dense(units=2, kernel_initializer=self._weight_init, use_bias=self._use_bias,
                              kernel_regularizer=l2(self._weight_decay), activation="softmax")(flatten)
        predictions_a = Dense(units=21, kernel_initializer=self._weight_init, use_bias=self._use_bias,
                              kernel_regularizer=l2(self._weight_decay), activation="softmax")(flatten)

        model = Model(inputs=inputs, outputs=[predictions_g, predictions_a])



        return model