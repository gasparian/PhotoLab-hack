  $(document).ready( function() {
        $('#submit_crowd').click(function() {
		var id_selected =	$( "#container_crowd" ).children( ".selected" )[0].id;
           $.post(
              "/upload_crowd",
              { id_selected: id_selected }
           ).done(function (reply) {
              $('#reply').empty().append(reply);
           });
        });
  });